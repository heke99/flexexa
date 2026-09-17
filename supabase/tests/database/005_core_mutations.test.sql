begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create temp table mutation_results(name text primary key,body jsonb);
grant all on mutation_results to authenticated;
insert into auth.users(id,email) values
 ('a5000000-0000-4000-8000-000000000001','core-admin@example.invalid'),
 ('a5000000-0000-4000-8000-000000000002','core-viewer@example.invalid');
insert into public.organizations(id,name,slug) values('b5000000-0000-4000-8000-000000000001','Core','core');
insert into public.tenants(id,organization_id,name,slug) values
 ('c5000000-0000-4000-8000-000000000001','b5000000-0000-4000-8000-000000000001','Core A','core-a'),
 ('c5000000-0000-4000-8000-000000000002','b5000000-0000-4000-8000-000000000001','Core B','core-b');
insert into public.memberships(id,tenant_id,user_id) values
 ('d5000000-0000-4000-8000-000000000001','c5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000001'),
 ('d5000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000001','a5000000-0000-4000-8000-000000000002');
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id
 where (m.id='d5000000-0000-4000-8000-000000000001' and r.role_key='tenant_admin')
 or (m.id='d5000000-0000-4000-8000-000000000002' and r.role_key='viewer');
insert into public.customers(id,tenant_id,customer_type,display_name) values
 ('e5000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000002','person','Other tenant');
insert into public.sites(id,tenant_id,customer_id,name) values
 ('f5000000-0000-4000-8000-000000000002','c5000000-0000-4000-8000-000000000002','e5000000-0000-4000-8000-000000000002','Other site');
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('idempotency_records','audit_events','outbox_events') and c.relrowsecurity),3::bigint,'all evidence tables have RLS');
select ok(not has_function_privilege('anon','public.flexexa_create_customer(uuid,jsonb,text,uuid)','EXECUTE'),'anon has no write RPC grant');
select ok(not has_function_privilege('authenticated','private.flexexa_normalize_core_input(text,jsonb)','EXECUTE'),'internal input helper not directly callable');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('flexexa_create_customer','flexexa_create_site','flexexa_create_metering_point','flexexa_create_asset') and not p.prosecdef),4::bigint,'public wrappers are invoker, not definer');
set local role anon;
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{}','anon','aa000000-0000-4000-8000-000000000001')$$,'42501',null,'anonymous RPC rejected');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
insert into mutation_results values('customer',public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"  Ada  ","external_customer_id":"customer-1"}','create-1','aa000000-0000-4000-8000-000000000001'));
select is((select display_name from public.customers where external_customer_id='customer-1'),'Ada','customer canonical normalization');
select is(public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"external_customer_id":"customer-1","display_name":"Ada","customer_type":"person"}','create-1','aa000000-0000-4000-8000-000000000002'),(select body from mutation_results where name='customer'),'canonical duplicate returns exact original receipt and correlation');
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"Other"}','create-1','aa000000-0000-4000-8000-000000000001')$$,'P0001','IDEMPOTENCY_CONFLICT','changed request cannot reuse key');
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000002','{"customer_type":"person","display_name":"Other"}','cross','aa000000-0000-4000-8000-000000000001')$$,'42501','PERMISSION_DENIED','body tenant cannot cross authorization');
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"Other","actor_id":"a5000000-0000-4000-8000-000000000002"}','actor-spoof','aa000000-0000-4000-8000-000000000001')$$,'P0001','VALIDATION_ERROR','actor may not be supplied by client');
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"Other"}',E'key\n','aa000000-0000-4000-8000-000000000001')$$,'P0001','VALIDATION_ERROR','trailing newline key rejected');
select throws_ok($$insert into public.customers(tenant_id,customer_type,display_name) values('c5000000-0000-4000-8000-000000000001','person','Bypass')$$,'42501',null,'direct write remains denied');
select throws_ok($$select * from public.idempotency_records$$,'42501',null,'browser cannot enumerate receipts');
select throws_ok($$select * from public.outbox_events$$,'42501',null,'browser cannot enumerate outbox');
reset role;
select is((select count(*) from public.idempotency_records),1::bigint,'failed and duplicate calls create no extra receipts');
select is((select count(*) from public.audit_events),1::bigint,'one audit for one committed creation');
select is((select count(*) from public.outbox_events),1::bigint,'one outbox event for one committed creation');
select ok((select actor_id='a5000000-0000-4000-8000-000000000001'::uuid from public.audit_events),'actor derives from auth context');
select ok(not exists(select 1 from public.outbox_events where payload_json::text like '%Ada%'),'outbox payload excludes customer PII');
select ok(not exists(select 1 from public.audit_events where metadata_json::text like '%Ada%'),'audit metadata excludes customer PII');
set local role authenticated;
insert into mutation_results values('site',public.flexexa_create_site('c5000000-0000-4000-8000-000000000001',jsonb_build_object('customer_id',(select body->>'resource_id' from mutation_results where name='customer'),'name','Home'),'create-1','aa000000-0000-4000-8000-000000000003'));
select is((select count(*) from public.sites),1::bigint,'same key in a different operation is independently scoped');
select throws_ok($$select public.flexexa_create_site('c5000000-0000-4000-8000-000000000001','{"customer_id":"e5000000-0000-4000-8000-000000000002","name":"Cross"}','bad-site','aa000000-0000-4000-8000-000000000001')$$,'P0001','TENANT_MISMATCH','cannot create own site for other tenant customer');
insert into mutation_results values('meter',public.flexexa_create_metering_point('c5000000-0000-4000-8000-000000000001',jsonb_build_object('site_id',(select body->>'resource_id' from mutation_results where name='site'),'external_metering_point_id','735999000000000001','metering_point_type','production'),'meter-1','aa000000-0000-4000-8000-000000000004'));
select ok((select not import_enabled and export_enabled from public.metering_points where external_metering_point_id='735999000000000001'),'meter directions derive from canonical type');
insert into mutation_results values('asset',public.flexexa_create_asset('c5000000-0000-4000-8000-000000000001',jsonb_build_object('customer_id',(select body->>'resource_id' from mutation_results where name='customer'),'site_id',(select body->>'resource_id' from mutation_results where name='site'),'asset_type','ev','display_name','Car','rated_power_kw','11.000'),'asset-1','aa000000-0000-4000-8000-000000000005'));
select ok((select not controllable and rated_power_kw=11 from public.assets where id=(select (body->>'resource_id')::uuid from mutation_results where name='asset')),'registration never grants control or rounds power');
select throws_ok($$select public.flexexa_create_metering_point('c5000000-0000-4000-8000-000000000001','{"site_id":"f5000000-0000-4000-8000-000000000002","external_metering_point_id":"cross"}','bad-meter','aa000000-0000-4000-8000-000000000001')$$,'P0001','TENANT_MISMATCH','cannot create meter at another tenant site');
insert into mutation_results values('second_customer',public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"company","display_name":"Company"}','customer-2','aa000000-0000-4000-8000-000000000006'));
select throws_ok($$select public.flexexa_create_asset('c5000000-0000-4000-8000-000000000001',jsonb_build_object('customer_id',(select body->>'resource_id' from mutation_results where name='second_customer'),'site_id',(select body->>'resource_id' from mutation_results where name='site'),'asset_type','ev','display_name','Mismatch'),'bad-customer-asset','aa000000-0000-4000-8000-000000000001')$$,'P0001','TENANT_MISMATCH','same-tenant wrong-customer site also rejected');
reset role;
update public.customers set status='archived' where id=(select (body->>'resource_id')::uuid from mutation_results where name='customer');
set local role authenticated;
select throws_ok($$select public.flexexa_create_site('c5000000-0000-4000-8000-000000000001',jsonb_build_object('customer_id',(select body->>'resource_id' from mutation_results where name='customer'),'name','Blocked'),'archived-site','aa000000-0000-4000-8000-000000000001')$$,'P0001','INVALID_STATE_TRANSITION','inactive parent blocks new child');
select is(public.flexexa_create_asset('c5000000-0000-4000-8000-000000000001',jsonb_build_object('customer_id',(select body->>'resource_id' from mutation_results where name='customer'),'site_id',(select body->>'resource_id' from mutation_results where name='site'),'asset_type','ev','display_name','Car','rated_power_kw','11'),'asset-1','aa000000-0000-4000-8000-000000000009'),(select body from mutation_results where name='asset'),'authorized replay returns original result despite parent state changing');
reset role;
insert into public.membership_permission_overrides(tenant_id,membership_id,permission_id,effect)
 select 'c5000000-0000-4000-8000-000000000001','d5000000-0000-4000-8000-000000000001',id,'deny' from public.permissions where permission_key='customers.write';
set local role authenticated;
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"Ada","external_customer_id":"customer-1"}','create-1','aa000000-0000-4000-8000-000000000001')$$,'42501','PERMISSION_DENIED','authorization is checked before replaying a receipt');
reset role;
update public.membership_permission_overrides set valid_until=now() where membership_id='d5000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a5000000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"Viewer"}','viewer','aa000000-0000-4000-8000-000000000001')$$,'42501','PERMISSION_DENIED','viewer cannot create');
select is((select count(*) from public.audit_events),0::bigint,'viewer has no audit read grant');
select set_config('request.jwt.claims','{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1","is_anonymous":true}',true);
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"Anon"}','anon-auth','aa000000-0000-4000-8000-000000000001')$$,'42501','PERMISSION_DENIED','anonymous sign-in cannot use an existing actor identifier');
select set_config('request.jwt.claims','{"sub":"a5000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
reset role;
-- Failure after the customer and audit INSERT must roll the entire RPC back.
create function private.test_reject_core_outbox() returns trigger language plpgsql as $$ begin raise exception 'TEST_OUTBOX_FAILURE'; end $$;
create trigger test_reject_core_outbox before insert on public.outbox_events for each row execute function private.test_reject_core_outbox();
set local role authenticated;
select throws_ok($$select public.flexexa_create_customer('c5000000-0000-4000-8000-000000000001','{"customer_type":"person","display_name":"Rollback","external_customer_id":"rollback-only"}','rollback-outbox','aa000000-0000-4000-8000-000000000001')$$,'P0001','TEST_OUTBOX_FAILURE','outbox failure aborts the entire write');
reset role;
drop trigger test_reject_core_outbox on public.outbox_events;
select is((select count(*) from public.customers where external_customer_id='rollback-only'),0::bigint,'failed outbox leaves no customer');
select is((select count(*) from public.idempotency_records where idempotency_key='rollback-outbox'),0::bigint,'failed outbox leaves no receipt');
select is((select count(*) from public.audit_events),5::bigint,'failed outbox leaves no audit fragment');
select is((select count(*) from public.outbox_events),5::bigint,'exactly one outbox for each committed operation');
select throws_ok($$update public.audit_events set metadata_json='{"tampered":true}'$$,'23514','AUDIT_IMMUTABLE','even privileged accidental audit overwrite is blocked');
select throws_ok($$delete from public.audit_events$$,'23514','AUDIT_IMMUTABLE','audit cannot cascade away');
select throws_ok($$update public.outbox_events set payload_json='{"tampered":true}'$$,'23514','OUTBOX_FACT_IMMUTABLE','outbox provenance immutable');
select throws_ok($$update public.idempotency_records set response_json='{}'$$,'23514','IDEMPOTENCY_RECEIPT_IMMUTABLE','completed receipts cannot be rewritten');
select throws_ok($$delete from public.customers where id=(select (body->>'resource_id')::uuid from mutation_results where name='customer')$$,'23503',null,'customer deletion cannot orphan active dependent sites/assets');
select ok(not exists(select 1 from public.audit_events a join public.idempotency_records i on i.id=a.idempotency_record_id where a.tenant_id<>i.tenant_id),'audit/receipt ownership agrees');
select ok(not exists(select 1 from public.outbox_events o join public.tenants t on t.id=o.tenant_id where o.organization_id<>t.organization_id),'outbox organization belongs to the same tenant');
delete from auth.users where id='a5000000-0000-4000-8000-000000000001';
select is((select count(*) from public.audit_events where actor_id='a5000000-0000-4000-8000-000000000001'),5::bigint,'user deletion preserves historical audit identifiers');
select * from finish();
rollback;
