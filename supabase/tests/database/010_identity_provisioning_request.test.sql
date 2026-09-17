begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.pid(n integer) returns uuid language sql immutable as $$select ('cf170000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create temp table provisioning_results(name text primary key,body jsonb);
grant all on provisioning_results to authenticated;
create function pg_temp.claims(n int default 1,s int default 101,extra jsonb default '{}') returns text language sql as $$
 select set_config('request.jwt.claims',(jsonb_build_object('sub',pg_temp.pid(n),'session_id',pg_temp.pid(s),'role','authenticated','aal','aal2')||extra)::text,true)
$$;
create function pg_temp.request(p jsonb default '{}',k text default 'request-1',c uuid default pg_temp.pid(900)) returns jsonb language sql as $$
 select public.flexexa_request_api_identity_provisioning(pg_temp.pid(20),jsonb_build_object('api_client_id',pg_temp.pid(40),'environment','sandbox')||p,k,c)
$$;
insert into auth.users(id,email,is_anonymous) select pg_temp.pid(n),'provision-admin-'||n||'@example.invalid',false from generate_series(1,2) n;
insert into auth.sessions(id,user_id) values(pg_temp.pid(101),pg_temp.pid(1)),(pg_temp.pid(102),pg_temp.pid(2));
insert into public.organizations(id,name,slug) values(pg_temp.pid(30),'Provisioning','provisioning-test');
insert into public.tenants(id,organization_id,name,slug) values(pg_temp.pid(20),pg_temp.pid(30),'A','provisioning-a'),(pg_temp.pid(21),pg_temp.pid(30),'B','provisioning-b');
insert into public.memberships(id,tenant_id,user_id) values(pg_temp.pid(31),pg_temp.pid(20),pg_temp.pid(1)),(pg_temp.pid(32),pg_temp.pid(20),pg_temp.pid(2));
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id
 where (m.id=pg_temp.pid(31) and r.role_key='tenant_admin') or (m.id=pg_temp.pid(32) and r.role_key='viewer');
insert into public.api_clients(id,tenant_id,client_id,name,expires_at) values(pg_temp.pid(40),pg_temp.pid(20),'provision-a','A',now()+interval '1 hour'),(pg_temp.pid(41),pg_temp.pid(21),'provision-b','B',now()+interval '1 hour');
select ok(not has_function_privilege('anon','public.flexexa_request_api_identity_provisioning(uuid,jsonb,text,uuid)','EXECUTE'),'anonymous request forbidden');
select ok(not has_table_privilege('authenticated','private.flexexa_identity_provisioning_requests','SELECT'),'private requests not browser-readable');
select ok(not has_table_privilege('authenticated','private.flexexa_identity_provisioning_requests','INSERT'),'private requests not browser-writable');
select ok((select relrowsecurity from pg_class where oid='private.flexexa_identity_provisioning_requests'::regclass),'request table has RLS');
select ok(not (select prosecdef from pg_proc where oid='public.flexexa_request_api_identity_provisioning(uuid,jsonb,text,uuid)'::regprocedure),'public wrapper is invoker');
set local role authenticated;
select pg_temp.claims(1,101,'{"aal":"aal1"}');
select throws_ok($$select pg_temp.request()$$,'42501','PERMISSION_DENIED','MFA required');
select pg_temp.claims(1,102);
select throws_ok($$select pg_temp.request()$$,'42501','PERMISSION_DENIED','other user session denied');
select pg_temp.claims(2,102);
select throws_ok($$select pg_temp.request()$$,'42501','PERMISSION_DENIED','viewer denied');
select pg_temp.claims(1,101,'{"role":"service_role"}');
select throws_ok($$select pg_temp.request()$$,'42501','PERMISSION_DENIED','service key is not an administrator session');
select pg_temp.claims();
select throws_ok($$select public.flexexa_request_api_identity_provisioning(pg_temp.pid(21),'{}','cross',pg_temp.pid(900))$$,'42501','PERMISSION_DENIED','cross-tenant request denied');
select throws_ok($$select pg_temp.request(jsonb_build_object('api_client_id',pg_temp.pid(41)))$$,'P0001','TENANT_MISMATCH','foreign client denied');
select throws_ok($$select pg_temp.request('{"environment":null}')$$,'P0001','VALIDATION_ERROR','missing environment denied');
select throws_ok($$select pg_temp.request('{"environment":"staging"}')$$,'P0001','VALIDATION_ERROR','unknown environment denied');
select throws_ok($$select pg_temp.request('{"secret":"unsafe"}')$$,'P0001','VALIDATION_ERROR','secret input forbidden');
select throws_ok($$select pg_temp.request(jsonb_build_object('auth_user_id',pg_temp.pid(1)))$$,'P0001','VALIDATION_ERROR','caller cannot choose Auth subject');
select throws_ok($$select pg_temp.request(jsonb_build_object('requested_by',pg_temp.pid(2)))$$,'P0001','VALIDATION_ERROR','caller cannot choose actor');
select throws_ok($$select pg_temp.request('{}',E'bad\n')$$,'P0001','VALIDATION_ERROR','newline key denied');
insert into provisioning_results values('first',pg_temp.request());
select is((select body->>'status' from provisioning_results where name='first'),'requested','receipt records request only');
select is(pg_temp.request('{}','request-1',pg_temp.pid(902)),(select body from provisioning_results where name='first'),'duplicate retains original operation/subject/correlation');
select throws_ok($$select pg_temp.request('{"environment":"production"}')$$,'P0001','IDEMPOTENCY_CONFLICT','different payload cannot reuse key');
reset role;
select is((select count(*) from private.flexexa_identity_provisioning_requests where tenant_id=pg_temp.pid(20)),1::bigint,'one durable intent');
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.pid(20)),1::bigint,'failed requests leave no receipt');
select is((select count(*) from public.audit_events where tenant_id=pg_temp.pid(20)),1::bigint,'one audit');
select is((select count(*) from public.outbox_events where tenant_id=pg_temp.pid(20)),1::bigint,'one outbox event');
select ok(not exists(select 1 from auth.users where id=(select (body->>'intended_auth_user_id')::uuid from provisioning_results where name='first')),'request does not create Auth user');
select is((select count(*) from private.flexexa_machine_principals where tenant_id=pg_temp.pid(20)),0::bigint,'request does not enroll a principal');
select is((select count(*) from public.api_client_permissions where tenant_id=pg_temp.pid(20)),0::bigint,'request grants no rights');
select ok((select expires_at<=created_at+interval '15 minutes' from private.flexexa_identity_provisioning_requests where tenant_id=pg_temp.pid(20)),'request lifetime bounded');
select throws_ok($$update private.flexexa_identity_provisioning_requests set environment='production' where tenant_id=pg_temp.pid(20)$$,'23514','AUDIT_IMMUTABLE','request identity immutable');
select throws_ok($$delete from private.flexexa_identity_provisioning_requests where tenant_id=pg_temp.pid(20)$$,'23514','AUDIT_IMMUTABLE','request evidence retained');
select throws_ok($$insert into private.flexexa_identity_provisioning_requests(tenant_id,api_client_id,environment,requested_by,idempotency_record_id,expires_at)
 select pg_temp.pid(21),pg_temp.pid(40),'sandbox',pg_temp.pid(1),id,now()+interval '1 minute' from public.idempotency_records where tenant_id=pg_temp.pid(20)$$,'23503',null,'foreign owner rejected by database constraints');
update public.memberships set status='suspended' where id=pg_temp.pid(31);
set local role authenticated;
select throws_ok($$select pg_temp.request()$$,'42501','PERMISSION_DENIED','replay rechecks authority');
reset role;
update public.memberships set status='active' where id=pg_temp.pid(31);
update public.api_clients set expires_at=now()+interval '1 minute' where id=pg_temp.pid(40);
set local role authenticated;
insert into provisioning_results values('short',pg_temp.request('{}','short'));
reset role;
select is((select expires_at from private.flexexa_identity_provisioning_requests where id=(select (body->>'resource_id')::uuid from provisioning_results where name='short')),
 (select expires_at from public.api_clients where id=pg_temp.pid(40)),'request cannot outlive client');
update public.api_clients set expires_at=now()-interval '1 second' where id=pg_temp.pid(40);
set local role authenticated;
select throws_ok($$select pg_temp.request('{}','expired')$$,'P0001','INVALID_STATE_TRANSITION','expired client denied');
select is(pg_temp.request(),(select body from provisioning_results where name='first'),'historical receipt does not imply live client or valid intent');
reset role;
update public.api_clients set expires_at=now()+interval '1 hour',client_type='public' where id=pg_temp.pid(40);
set local role authenticated;
select throws_ok($$select pg_temp.request('{}','public')$$,'P0001','INVALID_STATE_TRANSITION','public client denied');
reset role;
update public.api_clients set client_type='api_key',status='revoked' where id=pg_temp.pid(40);
set local role authenticated;
select throws_ok($$select pg_temp.request('{}','revoked')$$,'P0001','INVALID_STATE_TRANSITION','revoked client denied');
reset role;
select * from finish();
rollback;
