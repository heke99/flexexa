begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.aid(n integer) returns uuid language sql immutable as $$select ('ac900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create temp table account_results(name text primary key,body jsonb);
grant all on account_results to authenticated;
create function pg_temp.register_account(p jsonb default '{}',k text default 'register-1',c uuid default pg_temp.aid(900)) returns jsonb language sql as $$
 select public.flexexa_register_provider_account(pg_temp.aid(20),jsonb_build_object('customer_id',pg_temp.aid(40),'provider_key','enode','environment','sandbox')||p,k,c)
$$;
create function pg_temp.revoke_account(p jsonb default '{}',k text default 'revoke-1',c uuid default pg_temp.aid(901)) returns jsonb language sql as $$
 select public.flexexa_revoke_provider_account(pg_temp.aid(20),jsonb_build_object('provider_account_id',(select body->>'resource_id' from account_results where name='register'),'environment','sandbox','reason_code','customer_request')||p,k,c)
$$;
insert into auth.users(id,email) values(pg_temp.aid(1),'account-admin@example.invalid'),(pg_temp.aid(2),'account-viewer@example.invalid');
insert into public.organizations(id,name,slug) values(pg_temp.aid(10),'Account test','account-test');
insert into public.tenants(id,organization_id,name,slug) values(pg_temp.aid(20),pg_temp.aid(10),'Account A','account-a'),(pg_temp.aid(21),pg_temp.aid(10),'Account B','account-b');
insert into public.memberships(id,tenant_id,user_id) values(pg_temp.aid(30),pg_temp.aid(20),pg_temp.aid(1)),(pg_temp.aid(31),pg_temp.aid(20),pg_temp.aid(2));
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id
 where (m.id=pg_temp.aid(30) and r.role_key='tenant_admin') or (m.id=pg_temp.aid(31) and r.role_key='viewer');
insert into public.customers(id,tenant_id,customer_type,display_name,status) values
 (pg_temp.aid(40),pg_temp.aid(20),'person','Owned','active'),(pg_temp.aid(41),pg_temp.aid(21),'person','Other','active'),(pg_temp.aid(42),pg_temp.aid(20),'person','Archived','archived');
select ok(not has_function_privilege('anon','public.flexexa_register_provider_account(uuid,jsonb,text,uuid)','EXECUTE'),'anon cannot register');
select ok(not has_function_privilege('anon','public.flexexa_revoke_provider_account(uuid,jsonb,text,uuid)','EXECUTE'),'anon cannot revoke');
select ok(not has_function_privilege('authenticated','private.flexexa_normalize_provider_account_input(text,jsonb)','EXECUTE'),'normalizer not exposed');
select is((select count(*) from pg_proc where oid in ('public.flexexa_register_provider_account(uuid,jsonb,text,uuid)'::regprocedure,'public.flexexa_revoke_provider_account(uuid,jsonb,text,uuid)'::regprocedure) and not prosecdef),2::bigint,'public boundaries preserve invoker rights');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.aid(1),'role','authenticated','aal','aal1')::text,true);
insert into account_results values('register',pg_temp.register_account());
select is((select body->>'status' from account_results where name='register'),'registered','receipt reports inventory registration');
select is((select connection_status from public.provider_accounts),'pending','registration cannot establish provider connectivity');
select is(pg_temp.register_account('{}','register-1',pg_temp.aid(902)),(select body from account_results where name='register'),'retry retains original receipt and correlation');
select is(pg_temp.register_account(jsonb_build_object('customer_id',upper(pg_temp.aid(40)::text))),(select body from account_results where name='register'),'normalized UUID retry matches');
select throws_ok($$select pg_temp.register_account('{"environment":"production"}')$$,'P0001','IDEMPOTENCY_CONFLICT','environment cannot change on retry');
select throws_ok($$select pg_temp.register_account('{"provider_key":"ocpp"}')$$,'P0001','IDEMPOTENCY_CONFLICT','provider cannot change on retry');
select throws_ok($$select pg_temp.register_account(jsonb_build_object('customer_id',pg_temp.aid(41)),'other')$$,'P0001','TENANT_MISMATCH','other tenant customer rejected');
select throws_ok($$select pg_temp.register_account(jsonb_build_object('customer_id',pg_temp.aid(42)),'archived')$$,'P0001','INVALID_STATE_TRANSITION','archived customer rejected');
select throws_ok($$select pg_temp.register_account('{"provider_key":"unknown"}','unknown')$$,'P0001','VALIDATION_ERROR','unknown provider rejected');
select throws_ok($$select pg_temp.register_account('{"environment":null}','missing')$$,'P0001','VALIDATION_ERROR','explicit environment required');
select throws_ok($$select pg_temp.register_account('{"connection_status":"connected"}','spoof')$$,'P0001','VALIDATION_ERROR','client cannot assert connected state');
select throws_ok($$select pg_temp.register_account('{"credential_reference":"vault://not-accepted"}','secret')$$,'P0001','VALIDATION_ERROR','secret references not accepted from browser');
select throws_ok($$select pg_temp.register_account('{}',E'bad\n')$$,'P0001','VALIDATION_ERROR','newline idempotency token denied');
select throws_ok($$select public.flexexa_register_provider_account(pg_temp.aid(21),'{}','cross',pg_temp.aid(900))$$,'42501','PERMISSION_DENIED','other tenant cannot be targeted');
select throws_ok($$update public.provider_accounts set connection_status='connected'$$,'42501',null,'direct browser writes denied');
select throws_ok($$select credential_reference from public.provider_accounts$$,'42501',null,'browser credential references remain hidden');
select throws_ok($$select pg_temp.revoke_account('{"environment":"production"}','wrong-env')$$,'P0001','TENANT_MISMATCH','revocation cannot cross environment');
insert into account_results values('direct',pg_temp.register_account('{"provider_key":"ocpp"}','direct-1'));
select is((select count(id) from public.provider_accounts),2::bigint,'direct OCPP registration works independently');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.aid(2),'role','authenticated','aal','aal1')::text,true);
select throws_ok($$select pg_temp.register_account()$$,'42501','PERMISSION_DENIED','viewer denied existing receipt');
select throws_ok($$select pg_temp.revoke_account()$$,'42501','PERMISSION_DENIED','viewer denied revocation');
select throws_ok($$select private.flexexa_mutate_provider_account('register',pg_temp.aid(20),'{}','private',pg_temp.aid(900))$$,'42501','PERMISSION_DENIED','calling private boundary cannot bypass authorization');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.aid(1),'role','authenticated','aal','aal1','is_anonymous',true)::text,true);
select throws_ok($$select pg_temp.register_account()$$,'42501','PERMISSION_DENIED','anonymous sign-in denied');
reset role;
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.aid(20)),2::bigint,'failed registrations leave no incomplete receipt');
select ok(not exists(select 1 from public.provider_accounts where credential_reference is not null or external_account_id is not null),'registration stores no provider secrets or upstream identity');
select is((select count(*) from public.integration_providers where key in ('enode','ocpp') and status='suspended'),2::bigint,'registering does not activate the catalog');
-- Add a historical connection to demonstrate that parent revocation does not rewrite it.
insert into public.sites(id,tenant_id,customer_id,name) values(pg_temp.aid(50),pg_temp.aid(20),pg_temp.aid(40),'Fixture');
insert into public.assets(id,tenant_id,customer_id,site_id,asset_type,display_name) values(pg_temp.aid(60),pg_temp.aid(20),pg_temp.aid(40),pg_temp.aid(50),'ev','Fixture');
update public.provider_accounts set external_account_id='fixture-only',connection_status='connected' where id=(select (body->>'resource_id')::uuid from account_results where name='register');
insert into public.asset_connections(id,tenant_id,customer_id,asset_id,provider_account_id,provider_id,environment,external_asset_id,connection_type)
 select pg_temp.aid(70),tenant_id,customer_id,pg_temp.aid(60),id,provider_id,environment,'fixture-device','aggregated_api' from public.provider_accounts where id=(select (body->>'resource_id')::uuid from account_results where name='register');
insert into account_results select 'history',to_jsonb(c) from public.asset_connections c where id=pg_temp.aid(70);
update public.customers set status='archived' where id=pg_temp.aid(40);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.aid(1),'role','authenticated','aal','aal1')::text,true);
insert into account_results values('revoke',pg_temp.revoke_account());
select is((select body->>'status' from account_results where name='revoke'),'revoked','inactive owner can still have account revoked');
select is(pg_temp.revoke_account('{}','revoke-1',pg_temp.aid(903)),(select body from account_results where name='revoke'),'revocation retry returns exact original receipt');
select throws_ok($$select pg_temp.revoke_account('{"reason_code":"security"}')$$,'P0001','IDEMPOTENCY_CONFLICT','changed revocation reason cannot replay');
select throws_ok($$select pg_temp.revoke_account('{}','new-revoke')$$,'P0001','INVALID_STATE_TRANSITION','terminal revocation cannot create duplicate effects under a new key');
select is(pg_temp.register_account(),(select body from account_results where name='register'),'registration receipt remains historical after revocation');
reset role;
select is((select connection_status from public.provider_accounts where id=(select (body->>'resource_id')::uuid from account_results where name='register')),'revoked','local account authority revoked');
select is((select to_jsonb(c) from public.asset_connections c where id=pg_temp.aid(70)),(select body from account_results where name='history'),'all historical connection fields unchanged');
update public.memberships set status='suspended' where id=pg_temp.aid(30);
set local role authenticated;
select throws_ok($$select pg_temp.register_account()$$,'42501','PERMISSION_DENIED','membership suspension prevents registration receipt replay');
select throws_ok($$select pg_temp.revoke_account()$$,'42501','PERMISSION_DENIED','membership suspension prevents revocation receipt replay');
reset role;
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.aid(20)),3::bigint,'two registrations and one revocation have three receipts');
select is((select count(*) from public.audit_events where tenant_id=pg_temp.aid(20)),3::bigint,'exactly three audits');
select is((select count(*) from public.outbox_events where tenant_id=pg_temp.aid(20)),3::bigint,'exactly three durable outbox facts');
select ok(not exists(select 1 from public.idempotency_records where tenant_id=pg_temp.aid(20) and status<>'completed'),'no unfinished records');
select ok(not exists(select 1 from public.outbox_events where tenant_id=pg_temp.aid(20) and (payload_json ? 'credential_reference' or payload_json ? 'external_account_id' or payload_json ? 'customer_id')),'outbox excludes credentials and upstream/customer identifiers');
select is((select metadata_json->>'reason_code' from public.audit_events where tenant_id=pg_temp.aid(20) and action='revoke_provider_account'),'customer_request','bounded revocation reason audited');
select ok(not exists(select 1 from public.outbox_events where tenant_id=pg_temp.aid(20) and (status<>'pending' or source<>'flexexa.connect')),'no publisher or remote operation claimed');
select * from finish();
rollback;
