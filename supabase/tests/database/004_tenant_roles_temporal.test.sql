begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
insert into auth.users(id,email) values
 ('a4000000-0000-4000-8000-000000000001','rbac-a@example.invalid'),
 ('a4000000-0000-4000-8000-000000000002','rbac-b@example.invalid');
insert into public.organizations(id,name,slug) values('b4000000-0000-4000-8000-000000000001','RBAC','rbac');
insert into public.tenants(id,organization_id,name,slug) values
 ('c4000000-0000-4000-8000-000000000001','b4000000-0000-4000-8000-000000000001','RBAC A','rbac-a'),
 ('c4000000-0000-4000-8000-000000000002','b4000000-0000-4000-8000-000000000001','RBAC B','rbac-b');
insert into public.memberships(id,tenant_id,user_id) values
 ('d4000000-0000-4000-8000-000000000001','c4000000-0000-4000-8000-000000000001','a4000000-0000-4000-8000-000000000001'),
 ('d4000000-0000-4000-8000-000000000002','c4000000-0000-4000-8000-000000000002','a4000000-0000-4000-8000-000000000002');
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id
 where m.id in ('d4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000002') and r.role_key='tenant_admin';
select is((select count(*) from public.role_templates),9::bigint,'nine tenant role templates');
select is((select count(*) from public.roles where tenant_id='c4000000-0000-4000-8000-000000000001'),9::bigint,'each tenant receives its own nine roles');
select is((select count(*) from public.roles where tenant_id is null),2::bigint,'only platform roles are global');
select is((select count(*) from public.permissions where status='active'),60::bigint,'complete V1 permission catalog plus meter/platform/outbox/inbox extensions');
select throws_ok($$insert into public.roles(role_key,name,scope_type) values('broken','Broken','tenant')$$,'23514',null,'tenant role cannot be ownerless');
select throws_ok($$insert into public.membership_roles(tenant_id,membership_id,role_id) select 'c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001',id from public.roles where tenant_id='c4000000-0000-4000-8000-000000000002' and role_key='viewer'$$,'23503',null,'role foreign key prevents cross-tenant assignment');
select throws_ok($$insert into public.role_permissions(tenant_id,role_id,permission_id) select 'c4000000-0000-4000-8000-000000000002',r.id,p.id from public.roles r cross join public.permissions p where r.tenant_id='c4000000-0000-4000-8000-000000000001' and r.role_key='viewer' and p.permission_key='assets.control'$$,'23514','ROLE_OWNER_MISMATCH','permission row must match role owner');
select throws_ok($$insert into public.role_permissions(tenant_id,role_id,permission_id) select r.tenant_id,r.id,p.id from public.roles r cross join public.permissions p where r.tenant_id='c4000000-0000-4000-8000-000000000001' and r.role_key='viewer' and p.permission_key='platform.manage'$$,'23514','PERMISSION_SCOPE_MISMATCH','platform permission cannot be granted to tenant role');
select throws_ok($$update public.roles set tenant_id='c4000000-0000-4000-8000-000000000002' where tenant_id='c4000000-0000-4000-8000-000000000001'$$,'23514','TENANT_ID_IMMUTABLE','role ownership immutable');
insert into public.api_clients(tenant_id,client_id,name,secret_hash) values('c4000000-0000-4000-8000-000000000001','test-client','test','synthetic-hash-not-a-credential');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.roles),9::bigint,'role RLS shows own roles only');
select is((select count(distinct tenant_id) from public.role_permissions),1::bigint,'role permission RLS shows own tenant only');
select ok(private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'canonical create permission granted');
select ok(private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customer.manage'),'legacy alias resolves to the same permission');
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000002','customers.write'),'canonical grant never crosses tenant');
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','platform.manage'),'tenant admin has no platform power');
select is((select count(*) from public.api_clients),1::bigint,'safe API client metadata readable');
select throws_ok($$select secret_hash from public.api_clients$$,'42501',null,'hash material not returned to browser roles');
reset role;
insert into public.membership_permission_overrides(tenant_id,membership_id,permission_id,effect)
 select 'c4000000-0000-4000-8000-000000000001','d4000000-0000-4000-8000-000000000001',id,'deny' from public.permissions where permission_key='customer.manage';
set local role authenticated;
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'legacy deny also blocks canonical key');
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customer.manage'),'legacy deny blocks alias');
select ok(not exists(select 1 from private.flexexa_effective_permissions('c4000000-0000-4000-8000-000000000001') p where p='customers.write'),'effective canonical list respects alias deny');
reset role;
update public.membership_permission_overrides set valid_until=now() where tenant_id='c4000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'valid_until is exclusive');
reset role;
update public.memberships set valid_until=now() where id='d4000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not private.flexexa_is_tenant_member('c4000000-0000-4000-8000-000000000001'),'expired membership not active');
select is((select count(*) from public.tenants),0::bigint,'tenant RLS respects expired membership');
reset role;
update public.memberships set valid_until=null,valid_from=now()+interval '1 hour' where id='d4000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'future membership does not grant');
reset role;
update public.memberships set valid_from=now() where id='d4000000-0000-4000-8000-000000000001';
update public.membership_roles set valid_until=now() where membership_id='d4000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not private.flexexa_has_role('c4000000-0000-4000-8000-000000000001','tenant_admin'),'expired role assignment is inactive');
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'expired assignment cannot grant permissions');
reset role;
update public.membership_roles set valid_until=null where membership_id='d4000000-0000-4000-8000-000000000001';
update public.roles set status='suspended' where tenant_id='c4000000-0000-4000-8000-000000000001' and role_key='tenant_admin';
set local role authenticated;
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'suspended role does not grant');
reset role;
update public.roles set status='active' where tenant_id='c4000000-0000-4000-8000-000000000001';
update public.role_permissions set condition_json='{"not_yet_implemented":true}' where role_id in (select id from public.roles where tenant_id='c4000000-0000-4000-8000-000000000001') and permission_id=(select id from public.permissions where permission_key='customers.write');
set local role authenticated;
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'unimplemented conditional allow fails closed');
reset role;
update public.role_permissions set condition_json='{}',valid_until=now() where role_id in (select id from public.roles where tenant_id='c4000000-0000-4000-8000-000000000001') and permission_id=(select id from public.permissions where permission_key='customers.write');
set local role authenticated;
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','customers.write'),'expired role permission denied');
reset role;
insert into public.membership_roles(tenant_id,membership_id,role_id) select tenant_id,'d4000000-0000-4000-8000-000000000001',id from public.roles where tenant_id='c4000000-0000-4000-8000-000000000001' and role_key='market_operator';
set local role authenticated;
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','flex.dispatch'),'dispatch requires MFA');
select set_config('request.jwt.claims','{"sub":"a4000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select ok(private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','flex.dispatch'),'MFA plus assigned market role grants dispatch');
reset role;
update public.permissions set requires_step_up=true where permission_key='flex.dispatch';
set local role authenticated;
select ok(not private.flexexa_has_permission('c4000000-0000-4000-8000-000000000001','flex.dispatch'),'step-up not guessed from MFA alone');
reset role;
select lives_ok($$insert into public.membership_roles(tenant_id,membership_id,role_id,valid_from,valid_until)
 select tenant_id,'d4000000-0000-4000-8000-000000000002',id,now()-interval '2 day',now()-interval '1 day' from public.roles where tenant_id='c4000000-0000-4000-8000-000000000002' and role_key='operator'$$,'historical assignment retained');
select lives_ok($$insert into public.membership_roles(tenant_id,membership_id,role_id,valid_from)
 select tenant_id,'d4000000-0000-4000-8000-000000000002',id,now()-interval '1 day' from public.roles where tenant_id='c4000000-0000-4000-8000-000000000002' and role_key='operator'$$,'adjacent new assignment does not overwrite history');
select throws_ok($$insert into public.membership_roles(tenant_id,membership_id,role_id,valid_from)
 select tenant_id,'d4000000-0000-4000-8000-000000000002',id,now() from public.roles where tenant_id='c4000000-0000-4000-8000-000000000002' and role_key='operator'$$,'23P01',null,'overlapping assignment rejected by database');
select * from finish();
rollback;
