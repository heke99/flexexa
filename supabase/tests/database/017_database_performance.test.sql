begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();

-- Test-only catalog classifier; never installed in public/private schemas.
-- Accept full default B-tree key prefixes (including reordered equality keys),
-- or a UNIQUE key subset proving at most one candidate. INCLUDE columns do not
-- count. Only a simple FK-column IS NOT NULL partial predicate is proven here.
create function pg_temp.fk_has_index(target regclass, fk_name text) returns boolean
language sql stable as $function$
 select exists (
  select 1 from pg_constraint f
  join pg_index i on i.indrelid=f.conrelid
  join pg_class ic on ic.oid=i.indexrelid
  join pg_am am on am.oid=ic.relam
  where f.conrelid=target and f.conname=fk_name and f.contype='f'
   and am.amname='btree' and i.indisvalid and i.indisready and i.indislive
   and i.indexprs is null and i.indnkeyatts > 0
   and not exists (select 1 from unnest(i.indclass::oid[]) oc
                   join pg_opclass op on op.oid=oc where not op.opcdefault)
   and (i.indpred is null or exists (
    select 1 from pg_attribute a where a.attrelid=f.conrelid
     and a.attnum=any(f.conkey)
     and pg_get_expr(i.indpred,i.indrelid)=format('(%I IS NOT NULL)',a.attname)
   ))
   and (
    (i.indnkeyatts >= cardinality(f.conkey)
     and (i.indkey::smallint[])[0:cardinality(f.conkey)-1] @> f.conkey)
    or (i.indisunique and (i.indkey::smallint[])[0:i.indnkeyatts-1] <@ f.conkey)
   )
 );
$function$;

select ok(pg_temp.fk_has_index(f.conrelid,f.conname),
 'FK index coverage: '||n.nspname||'.'||c.relname||'.'||f.conname)
from pg_constraint f join pg_class c on c.oid=f.conrelid
join pg_namespace n on n.oid=c.relnamespace
where f.contype='f' and n.nspname in ('public','private')
order by n.nspname,c.relname,f.conname;
select ok((select count(*) from pg_constraint f join pg_class c on c.oid=f.conrelid
 join pg_namespace n on n.oid=c.relnamespace
 where f.contype='f' and n.nspname in ('public','private')) > 50,
 'coverage checks the real application catalog, not an empty fixture');

select ok(exists (
 select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
 join pg_namespace n on n.oid=c.relnamespace join pg_am am on am.oid=c.relam
 where n.nspname='public' and c.relname=expected.name
  and i.indrelid=('public.'||expected.table_name)::regclass
  and i.indisvalid and i.indisready and not i.indisunique
  and i.indpred is null and i.indexprs is null and am.amname='btree'
  and array(select a.attname::text from unnest(i.indkey::smallint[]) with ordinality k(attnum,ord)
    join pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum order by k.ord)=expected.columns
 ), 'exact valid index: '||expected.name)
from (values
 ('api_client_permissions_permission_idx','api_client_permissions',array['permission_id']),
 ('api_clients_created_by_idx','api_clients',array['created_by']),
 ('assets_tenant_site_customer_idx','assets',array['tenant_id','site_id','customer_id']),
 ('inbox_organization_tenant_idx','inbox_events',array['organization_id','tenant_id']),
 ('overrides_approved_by_idx','membership_permission_overrides',array['approved_by']),
 ('overrides_created_by_idx','membership_permission_overrides',array['created_by']),
 ('overrides_permission_idx','membership_permission_overrides',array['permission_id']),
 ('membership_roles_created_by_idx','membership_roles',array['created_by']),
 ('membership_roles_role_tenant_idx','membership_roles',array['role_id','tenant_id']),
 ('memberships_invited_by_idx','memberships',array['invited_by']),
 ('outbox_organization_tenant_idx','outbox_events',array['organization_id','tenant_id']),
 ('permission_aliases_canonical_idx','permission_aliases',array['canonical_permission_id']),
 ('platform_membership_roles_role_idx','platform_membership_roles',array['role_id']),
 ('role_permissions_permission_idx','role_permissions',array['permission_id']),
 ('role_permissions_role_tenant_idx','role_permissions',array['role_id','tenant_id']),
 ('role_template_permissions_permission_idx','role_template_permissions',array['permission_id']),
 ('roles_template_idx','roles',array['role_template_id']),
 ('service_identity_grants_permission_idx','service_identity_tenant_grants',array['permission_id']),
 ('tenants_market_area_idx','tenants',array['default_market_area_id'])
) expected(name,table_name,columns);
select ok(to_regclass('public.assets_tenant_site_idx') is null
 and to_regclass('public.inbox_organization_idx') is null
 and to_regclass('public.outbox_organization_idx') is null,
 'only the three superseded non-unique prefix indexes were removed');
select ok(pg_temp.fk_has_index('private.flexexa_identity_provisioning_completions',
 'flexexa_identity_provisioning_tenant_id_request_id_lease_i_fkey'),
 'unique tenant/request index bounds the completion triple FK lookup');

-- Exercise the classifier on real PostgreSQL indexes, including false positives.
create temporary table fk_parent(a integer,b integer,primary key(a,b));
create temporary table fk_child(x integer,a integer,b integer,c integer,
 constraint fk_probe foreign key(a,b) references fk_parent(a,b));
select ok(not pg_temp.fk_has_index('fk_child','fk_probe'),'missing child index is rejected');
create index fk_wrong_prefix on fk_child(x,a,b);
select ok(not pg_temp.fk_has_index('fk_child','fk_probe'),'non-FK leading column is rejected');
drop index fk_wrong_prefix;
create index fk_include_only on fk_child(a) include(b);
select ok(not pg_temp.fk_has_index('fk_child','fk_probe'),'INCLUDE is not a searchable key');
drop index fk_include_only;
create index fk_wrong_predicate on fk_child(a,b) where c > 0;
select ok(not pg_temp.fk_has_index('fk_child','fk_probe'),'unproven partial predicate is rejected');
drop index fk_wrong_predicate;
create index fk_expression on fk_child((a+1),b);
select ok(not pg_temp.fk_has_index('fk_child','fk_probe'),'expression keys are not mistaken for FK columns');
drop index fk_expression;
create unique index fk_wrong_unique on fk_child(a,c);
select ok(not pg_temp.fk_has_index('fk_child','fk_probe'),'unrelated unique key cannot prove bounded lookup');
drop index fk_wrong_unique;
create index fk_reordered on fk_child(b,a);
select ok(pg_temp.fk_has_index('fk_child','fk_probe'),'all equality keys may appear in either order');
drop index fk_reordered;
create index fk_nullable on fk_child(a,b) where a is not null;
select ok(pg_temp.fk_has_index('fk_child','fk_probe'),'null-only FK predicate is implied by equality');
drop index fk_nullable;
create unique index fk_bounded on fk_child(a);
select ok(pg_temp.fk_has_index('fk_child','fk_probe'),'unique FK subset proves at most one candidate');
select ok(not pg_temp.fk_has_index('fk_child','missing'),'missing FK does not accidentally pass');

select ok(pol.polcmd='r' and pol.polpermissive
 and pol.polroles=array[(select oid from pg_roles where rolname='authenticated')]
 and pol.polwithcheck is null
 and pg_get_expr(pol.polqual,pol.polrelid) ~ 'SELECT[[:space:]]+auth.uid',
 'statement-cached uid with unchanged policy scope: '||pol.polname)
from pg_policy pol where (pol.polrelid,pol.polname) in (
 ('public.memberships'::regclass,'memberships_self_or_authorized_read'),
 ('public.platform_memberships'::regclass,'platform_memberships_self_or_platform_read'));
select is((select count(*) from pg_policy where polname in
 ('memberships_self_or_authorized_read','platform_memberships_self_or_platform_read')),2::bigint,
 'both existing policies remain present');

create function pg_temp.explain_json(sql_text text) returns jsonb language plpgsql as $body$
declare result json;
begin
 execute 'explain (format json) '||sql_text into result;
 return result::jsonb;
end;
$body$;
insert into auth.users(id,email) values
 ('a1700000-0000-4000-8000-000000000001','perf-a@example.invalid'),
 ('a1700000-0000-4000-8000-000000000002','perf-b@example.invalid'),
 ('a1700000-0000-4000-8000-000000000003','perf-c@example.invalid'),
 ('a1700000-0000-4000-8000-000000000004','perf-outsider@example.invalid');
insert into public.organizations(id,name,slug) values
 ('b1700000-0000-4000-8000-000000000001','Performance A','perf-a'),
 ('b1700000-0000-4000-8000-000000000002','Performance B','perf-b');
insert into public.tenants(id,organization_id,name,slug) values
 ('c1700000-0000-4000-8000-000000000001','b1700000-0000-4000-8000-000000000001','Performance A','perf-a'),
 ('c1700000-0000-4000-8000-000000000002','b1700000-0000-4000-8000-000000000002','Performance B','perf-b');
insert into public.memberships(id,tenant_id,user_id) values
 ('d1700000-0000-4000-8000-000000000001','c1700000-0000-4000-8000-000000000001','a1700000-0000-4000-8000-000000000001'),
 ('d1700000-0000-4000-8000-000000000002','c1700000-0000-4000-8000-000000000002','a1700000-0000-4000-8000-000000000002'),
 ('d1700000-0000-4000-8000-000000000003','c1700000-0000-4000-8000-000000000001','a1700000-0000-4000-8000-000000000003');
insert into public.platform_memberships(id,user_id) values
 ('e1700000-0000-4000-8000-000000000001','a1700000-0000-4000-8000-000000000001'),
 ('e1700000-0000-4000-8000-000000000002','a1700000-0000-4000-8000-000000000002');
insert into public.platform_membership_roles(platform_membership_id,role_id)
 select 'e1700000-0000-4000-8000-000000000002',id from public.roles where role_key='platform_admin';

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.memberships),1::bigint,'ordinary caller sees own membership only');
select is((select count(*) from public.memberships where tenant_id='c1700000-0000-4000-8000-000000000002'),0::bigint,'other tenant membership denied');
select is((select count(*) from public.platform_memberships),1::bigint,'ordinary caller sees own platform membership only');
select ok(position('InitPlan' in pg_temp.explain_json('select id from public.memberships')::text)>0,
 'Postgres actually plans statement-level uid evaluation for memberships');
select ok(position('InitPlan' in pg_temp.explain_json('select id from public.platform_memberships')::text)>0,
 'Postgres actually plans statement-level uid evaluation for platform memberships');
select throws_ok($$update public.memberships set status='active'$$,'42501',null,'direct membership writes still denied');

select set_config('request.jwt.claims','{"sub":"a1700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.memberships),1::bigint,'new statement does not reuse the previous caller uid');
select is((select count(*) from public.memberships where user_id='a1700000-0000-4000-8000-000000000001'),0::bigint,'MFA-less platform role cannot see another caller');
select is((select count(*) from public.platform_memberships),1::bigint,'platform role without MFA still sees only self');
select set_config('request.jwt.claims','{"sub":"a1700000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*) from public.memberships),3::bigint,'existing MFA platform-admin read preserved');
select is((select count(*) from public.platform_memberships),2::bigint,'existing MFA platform membership read preserved');
reset role;
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select 'c1700000-0000-4000-8000-000000000001','d1700000-0000-4000-8000-000000000001',id
 from public.roles where tenant_id='c1700000-0000-4000-8000-000000000001' and role_key='tenant_admin';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1700000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.memberships),2::bigint,'authorized tenant administrator sees own tenant members');
select is((select count(*) from public.memberships where tenant_id='c1700000-0000-4000-8000-000000000002'),0::bigint,'tenant administrator cannot cross tenant');
reset role;
update public.memberships set status='revoked' where id='d1700000-0000-4000-8000-000000000001';
set local role authenticated;
select is((select count(*) from public.memberships),1::bigint,'revoked member retains original self-metadata read but no tenant-wide read');
select ok(not private.flexexa_is_tenant_member('c1700000-0000-4000-8000-000000000001'),'self metadata is not active tenant authorization');
select set_config('request.jwt.claims','{"sub":"a1700000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select is((select count(*) from public.memberships),0::bigint,'unassigned outsider sees no memberships');
select is((select count(*) from public.platform_memberships),0::bigint,'MFA alone grants no platform membership access');
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
select is((select count(*) from public.memberships),0::bigint,'missing user identity fails closed');
select is((select count(*) from public.platform_memberships),0::bigint,'missing identity fails closed for platform metadata');
reset role;
set local role anon;
select throws_ok($$select id from public.memberships$$,'42501',null,'anon membership table privilege still denied');
reset role;
select * from finish();
rollback;
