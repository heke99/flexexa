begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
select has_table('public','customers','customers are present in clean replay');
select has_table('public','sites','sites are present in clean replay');
select has_table('public','metering_points','meters are present in clean replay');
select has_table('public','assets','assets are present in clean replay');
select has_table('public','asset_capabilities','capabilities are present in clean replay');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('customers','sites','metering_points','assets','asset_capabilities') and c.relrowsecurity),5::bigint,'all core tables have RLS');
insert into auth.users(id,email) values
 ('a1000000-0000-4000-8000-000000000001','core-a@example.invalid'),
 ('a1000000-0000-4000-8000-000000000002','core-b@example.invalid');
insert into public.organizations(id,name,slug) values
 ('b1000000-0000-4000-8000-000000000001','Core A','core-a'),
 ('b1000000-0000-4000-8000-000000000002','Core B','core-b');
insert into public.tenants(id,organization_id,name,slug) values
 ('c1000000-0000-4000-8000-000000000001','b1000000-0000-4000-8000-000000000001','Core A','core-a'),
 ('c1000000-0000-4000-8000-000000000002','b1000000-0000-4000-8000-000000000002','Core B','core-b');
insert into public.memberships(id,tenant_id,user_id) values
 ('d1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000001'),
 ('d1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000002');
insert into public.membership_roles(tenant_id,membership_id,role_id)
select m.tenant_id,m.id,r.id from public.memberships m cross join public.roles r
where m.id in ('d1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000002') and r.role_key='tenant_admin';
insert into public.customers(id,tenant_id,customer_type,display_name,external_customer_id) values
 ('e1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','person','A1','shared-external-id'),
 ('e1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','person','A2','second'),
 ('e1000000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000002','person','B1','shared-external-id');
insert into public.sites(id,tenant_id,customer_id,name) values
 ('f1000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','Site A'),
 ('f1000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003','Site B');
insert into public.metering_points(tenant_id,site_id,external_metering_point_id) values
 ('c1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','meter-a'),
 ('c1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','meter-b');
insert into public.assets(id,tenant_id,site_id,customer_id,asset_type,display_name) values
 ('a2000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001','meter','Asset A'),
 ('a2000000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003','meter','Asset B');
insert into public.asset_capabilities(tenant_id,asset_id,capability) values
 ('c1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000001','read_power'),
 ('c1000000-0000-4000-8000-000000000002','a2000000-0000-4000-8000-000000000002','read_power');
select throws_ok($$insert into public.sites(tenant_id,customer_id,name) values('c1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000003','wrong tenant')$$,'23503',null,'site cannot point at another tenant customer');
select throws_ok($$insert into public.metering_points(tenant_id,site_id,external_metering_point_id) values('c1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000002','wrong')$$,'23503',null,'meter cannot point at another tenant site');
select throws_ok($$insert into public.assets(tenant_id,site_id,customer_id,asset_type,display_name) values('c1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','meter','wrong customer')$$,'23503',null,'asset cannot use a different customer even within same tenant');
select throws_ok($$insert into public.asset_capabilities(tenant_id,asset_id,capability) values('c1000000-0000-4000-8000-000000000001','a2000000-0000-4000-8000-000000000002','read_energy')$$,'23503',null,'capability cannot point at another tenant asset');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.customers),2::bigint,'customer read is tenant-scoped');
select is((select count(*) from public.sites),1::bigint,'site read is tenant-scoped');
select is((select count(*) from public.metering_points),1::bigint,'meter read is tenant-scoped');
select is((select count(*) from public.assets),1::bigint,'asset read is tenant-scoped');
select is((select count(*) from public.asset_capabilities),1::bigint,'capability read is tenant-scoped');
select throws_ok($$insert into public.customers(tenant_id,customer_type,display_name) values('c1000000-0000-4000-8000-000000000001','person','direct insert')$$,'42501',null,'tenant admin cannot bypass write RPC');
select throws_ok($$update public.sites set name='direct update'$$,'42501',null,'direct update denied');
select throws_ok($$delete from public.assets$$,'42501',null,'direct delete denied');
select set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*) from public.customers),1::bigint,'other tenant sees its own customer only');
reset role;
set local role anon;
select throws_ok($$select * from public.customers$$,'42501',null,'anonymous customer read denied');
reset role;
select * from finish();
rollback;
