begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(21);
insert into auth.users(id,email) values
 ('a0000000-0000-4000-8000-000000000001','flexexa-ci-a@example.invalid'),
 ('a0000000-0000-4000-8000-000000000002','flexexa-ci-b@example.invalid'),
 ('a0000000-0000-4000-8000-000000000003','flexexa-ci-platform@example.invalid');
insert into public.organizations(id,name,slug) values
 ('b0000000-0000-4000-8000-000000000001','Test organization A','flexexa-ci-org-a'),
 ('b0000000-0000-4000-8000-000000000002','Test organization B','flexexa-ci-org-b');
insert into public.tenants(id,organization_id,name,slug) values
 ('c0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000001','Test A','flexexa-ci-a'),
 ('c0000000-0000-4000-8000-000000000002','b0000000-0000-4000-8000-000000000002','Test B','flexexa-ci-b');
insert into public.memberships(id,tenant_id,user_id) values
 ('d0000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001'),
 ('d0000000-0000-4000-8000-000000000002','c0000000-0000-4000-8000-000000000002','a0000000-0000-4000-8000-000000000002');
insert into public.membership_roles(tenant_id,membership_id,role_id)
select 'c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',id from public.roles where role_key='operator' and tenant_id='c0000000-0000-4000-8000-000000000001';
insert into public.platform_memberships(id,user_id) values
 ('e0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000003');
insert into public.platform_membership_roles(platform_membership_id,role_id)
select 'e0000000-0000-4000-8000-000000000003',id from public.roles where role_key='platform_admin';
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'flexexa_%' and has_function_privilege('anon',p.oid,'execute')), 'anon has no explicit helper execute grants');
select ok(not has_schema_privilege('anon','private','usage'),'anon cannot resolve private schema');
select throws_ok($$insert into public.membership_roles(tenant_id,membership_id,role_id) select 'c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',id from public.roles where role_key='superadmin'$$,'23514','ROLE_SCOPE_MISMATCH','platform role cannot be assigned to tenant membership');
select throws_ok($$insert into public.platform_membership_roles(platform_membership_id,role_id) select 'e0000000-0000-4000-8000-000000000003',id from public.roles where role_key='viewer'$$,'23514','ROLE_SCOPE_MISMATCH','tenant role cannot be assigned as platform role');
select throws_ok($$insert into public.membership_roles(tenant_id,membership_id,role_id) select 'c0000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000001',id from public.roles where role_key='viewer'$$,'23503',null,'composite FK blocks tenant mismatch');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select ok(private.flexexa_is_tenant_member('c0000000-0000-4000-8000-000000000001'),'active own membership accepted');
select ok(not private.flexexa_is_tenant_member('c0000000-0000-4000-8000-000000000002'),'other tenant membership denied');
select is((select count(*) from public.tenants),1::bigint,'RLS exposes exactly own tenant');
select ok(private.flexexa_has_permission('c0000000-0000-4000-8000-000000000001','control.execute'),'operator receives assigned control permission');
select ok(not private.flexexa_has_permission('c0000000-0000-4000-8000-000000000002','control.execute'),'permission does not cross tenant');
select ok(not private.flexexa_has_permission('c0000000-0000-4000-8000-000000000001','unknown.permission'),'unknown permission denied');
select throws_ok($$insert into public.tenants(organization_id,name,slug) values('b0000000-0000-4000-8000-000000000001','Forbidden','forbidden')$$,'42501',null,'direct authenticated tenant write denied');
reset role;
insert into public.membership_permission_overrides(tenant_id,membership_id,permission_id,effect)
select 'c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',id,'deny' from public.permissions where permission_key='control.execute';
set local role authenticated;
select ok(not private.flexexa_has_permission('c0000000-0000-4000-8000-000000000001','control.execute'),'explicit deny overrides role allow');
select ok(not exists(select 1 from private.flexexa_effective_permissions('c0000000-0000-4000-8000-000000000001') p where p='assets.control'),'effective canonical permission list agrees with deny decision');
reset role;
update public.tenants set status='suspended' where id='c0000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not private.flexexa_is_tenant_member('c0000000-0000-4000-8000-000000000001'),'suspended tenant disables access');
reset role;
update public.tenants set status='active' where id='c0000000-0000-4000-8000-000000000001';
update public.organizations set status='suspended' where id='b0000000-0000-4000-8000-000000000001';
set local role authenticated;
select ok(not private.flexexa_is_tenant_member('c0000000-0000-4000-8000-000000000001'),'suspended organization disables access');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal1"}',true);
select ok(not private.flexexa_is_platform_admin(),'platform actions require MFA');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select ok(private.flexexa_is_platform_admin(),'platform admin with MFA recognized');
select ok(not private.flexexa_has_permission('c0000000-0000-4000-8000-000000000002','unknown.permission'),'platform role cannot authorize unknown permission');
select ok(not private.flexexa_has_permission('c0000000-0000-4000-8000-000000000002','control.execute'),'platform role is not implicit tenant control access');
select set_config('request.jwt.claims','{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated","is_anonymous":true,"aal":"aal1"}',true);
select ok(not private.flexexa_is_tenant_member('c0000000-0000-4000-8000-000000000002'),'anonymous sign-in is not tenant membership authorization');
reset role;
select * from finish();
rollback;
