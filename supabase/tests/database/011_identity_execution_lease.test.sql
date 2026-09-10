begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.lid(n integer) returns uuid language sql immutable as $$select ('cf180000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create temp table lease_results(name text primary key,body jsonb);
grant all on lease_results to authenticated;
create function pg_temp.claims(n int default 1,s int default 101,extra jsonb default '{}') returns text language sql as $$
 select set_config('request.jwt.claims',(jsonb_build_object('sub',pg_temp.lid(n),'session_id',pg_temp.lid(s),'role','authenticated','aal','aal2')||extra)::text,true)
$$;
create function pg_temp.acquire(k text default 'lease-1',p jsonb default '{}',c uuid default pg_temp.lid(900)) returns jsonb language sql as $$
 select public.flexexa_acquire_identity_execution_lease(pg_temp.lid(20),jsonb_build_object('request_id',(select body->>'resource_id' from lease_results where name='intent'),'environment','sandbox')||p,k,c)
$$;
create function pg_temp.check_lease(n text default 'first') returns jsonb language sql as $$
 select public.flexexa_check_identity_execution_lease(pg_temp.lid(20),(select (body->>'resource_id')::uuid from lease_results where name=n))
$$;
insert into auth.users(id,email,is_anonymous) select pg_temp.lid(n),'lease-admin-'||n||'@example.invalid',false from generate_series(1,2) n;
insert into auth.sessions(id,user_id) values(pg_temp.lid(101),pg_temp.lid(1)),(pg_temp.lid(102),pg_temp.lid(2)),(pg_temp.lid(103),pg_temp.lid(1));
insert into public.organizations(id,name,slug) values(pg_temp.lid(30),'Leases','lease-test');
insert into public.tenants(id,organization_id,name,slug) values(pg_temp.lid(20),pg_temp.lid(30),'A','lease-a'),(pg_temp.lid(21),pg_temp.lid(30),'B','lease-b');
insert into public.memberships(id,tenant_id,user_id) values(pg_temp.lid(31),pg_temp.lid(20),pg_temp.lid(1)),(pg_temp.lid(32),pg_temp.lid(20),pg_temp.lid(2));
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id where m.id in (pg_temp.lid(31),pg_temp.lid(32)) and r.role_key='tenant_admin';
insert into public.api_clients(id,tenant_id,client_id,name,expires_at) values(pg_temp.lid(40),pg_temp.lid(20),'lease-a','A',now()+interval '1 hour');
select ok(not has_function_privilege('anon','public.flexexa_acquire_identity_execution_lease(uuid,jsonb,text,uuid)','EXECUTE'),'anonymous acquisition denied');
select ok(not has_function_privilege('anon','public.flexexa_check_identity_execution_lease(uuid,uuid)','EXECUTE'),'anonymous check denied');
select ok(not has_function_privilege('authenticated','private.flexexa_lock_identity_execution_request(uuid,uuid)','EXECUTE'),'internal lock helper is not a caller bypass');
select ok(not has_table_privilege('authenticated','private.flexexa_identity_execution_leases','SELECT'),'leases not browser-readable');
select ok(not has_table_privilege('authenticated','private.flexexa_identity_execution_leases','INSERT'),'leases not browser-writable');
select ok((select relrowsecurity from pg_class where oid='private.flexexa_identity_execution_leases'::regclass),'leases have RLS');
select ok(not (select prosecdef from pg_proc where oid='public.flexexa_acquire_identity_execution_lease(uuid,jsonb,text,uuid)'::regprocedure),'acquire wrapper is invoker');
select ok(not (select prosecdef from pg_proc where oid='public.flexexa_check_identity_execution_lease(uuid,uuid)'::regprocedure),'check wrapper is invoker');
set local role authenticated;
select pg_temp.claims();
insert into lease_results values('intent',public.flexexa_request_api_identity_provisioning(pg_temp.lid(20),jsonb_build_object('api_client_id',pg_temp.lid(40),'environment','sandbox'),'intent',pg_temp.lid(900)));
select pg_temp.claims(1,101,'{"aal":"aal1"}');
select throws_ok($$select pg_temp.acquire()$$,'42501','PERMISSION_DENIED','MFA required');
select pg_temp.claims(1,102);
select throws_ok($$select pg_temp.acquire()$$,'42501','PERMISSION_DENIED','another user session denied');
select pg_temp.claims(2,102);
select throws_ok($$select pg_temp.acquire()$$,'42501','PERMISSION_DENIED','another administrator cannot adopt intent');
select pg_temp.claims(1,101,'{"role":"service_role"}');
select throws_ok($$select pg_temp.acquire()$$,'42501','PERMISSION_DENIED','universal service claim is not caller MFA');
select pg_temp.claims();
select throws_ok($$select pg_temp.acquire('invalid','{"environment":"production"}')$$,'42501','PERMISSION_DENIED','environment bound to intent');
select throws_ok($$select pg_temp.acquire('invalid','{"secret":"forbidden"}')$$,'P0001','VALIDATION_ERROR','secret input forbidden');
select throws_ok($$select pg_temp.acquire('invalid','{"generation":10}')$$,'P0001','VALIDATION_ERROR','caller cannot choose generation');
select throws_ok($$select pg_temp.acquire(E'bad\n')$$,'P0001','VALIDATION_ERROR','invalid key denied');
select throws_ok($$select public.flexexa_acquire_identity_execution_lease(pg_temp.lid(21),'{}','cross',pg_temp.lid(900))$$,'42501','PERMISSION_DENIED','foreign tenant denied');
insert into lease_results values('first',pg_temp.acquire());
select is((select body->>'generation' from lease_results where name='first'),'1','first generation is server assigned');
select is(pg_temp.acquire('lease-1','{}',pg_temp.lid(901)),(select body from lease_results where name='first'),'active duplicate preserves lease and correlation');
select is(pg_temp.check_lease()->>'intended_auth_user_id',(select body->>'intended_auth_user_id' from lease_results where name='intent'),'lease retains reserved identity');
select throws_ok($$select pg_temp.acquire('competing')$$,'P0001','INVALID_STATE_TRANSITION','concurrent different attempt denied');
select pg_temp.claims(1,103);
select throws_ok($$select pg_temp.acquire()$$,'P0001','IDEMPOTENCY_CONFLICT','same key cannot change session');
select throws_ok($$select pg_temp.check_lease()$$,'P0001','INVALID_STATE_TRANSITION','other session cannot use lease');
select pg_temp.claims();
reset role;
select is((select count(*) from private.flexexa_identity_execution_leases where tenant_id=pg_temp.lid(20)),1::bigint,'one lease stored');
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.lid(20)),2::bigint,'failed attempts leave no receipts');
select is((select count(*) from public.audit_events where tenant_id=pg_temp.lid(20)),2::bigint,'intent and lease audited');
select is((select count(*) from public.outbox_events where tenant_id=pg_temp.lid(20)),2::bigint,'intent and lease events atomic');
select ok(not exists(select 1 from auth.users where id=(select (body->>'intended_auth_user_id')::uuid from lease_results where name='intent')),'lease creates no Auth user');
select is((select count(*) from private.flexexa_machine_principals where tenant_id=pg_temp.lid(20)),0::bigint,'lease does not enroll');
select is((select count(*) from public.api_client_permissions where tenant_id=pg_temp.lid(20)),0::bigint,'lease grants no permission');
select ok((select l.expires_at<=l.created_at+interval '30 seconds' and l.expires_at<=r.expires_at from private.flexexa_identity_execution_leases l join private.flexexa_identity_provisioning_requests r on r.tenant_id=l.tenant_id and r.id=l.request_id where l.tenant_id=pg_temp.lid(20)),'lease bounded by 30 seconds and intent');
select throws_ok($$update private.flexexa_identity_execution_leases set generation=99 where tenant_id=pg_temp.lid(20)$$,'23514','AUDIT_IMMUTABLE','generation evidence immutable');
select throws_ok($$delete from private.flexexa_identity_execution_leases where tenant_id=pg_temp.lid(20)$$,'23514','AUDIT_IMMUTABLE','lease evidence retained');
select throws_ok($$insert into private.flexexa_identity_execution_leases(tenant_id,request_id,generation,session_id,idempotency_record_id,created_at,expires_at)
 select pg_temp.lid(21),request_id,1,session_id,idempotency_record_id,created_at,expires_at from private.flexexa_identity_execution_leases where tenant_id=pg_temp.lid(20)$$,'23503',null,'composite constraints deny foreign tenant ownership');
update public.memberships set status='suspended' where id=pg_temp.lid(31);
set local role authenticated;
select throws_ok($$select pg_temp.check_lease()$$,'42501','PERMISSION_DENIED','continuation rechecks current membership');
select throws_ok($$select pg_temp.acquire()$$,'42501','PERMISSION_DENIED','replay rechecks current membership');
reset role;
update public.memberships set status='active' where id=pg_temp.lid(31);
update auth.sessions set not_after=now()-interval '1 second' where id=pg_temp.lid(101);
set local role authenticated;
select throws_ok($$select pg_temp.check_lease()$$,'42501','PERMISSION_DENIED','expired authorizing session denied');
reset role;
update auth.sessions set not_after=null where id=pg_temp.lid(101);
update public.api_clients set status='revoked' where id=pg_temp.lid(40);
set local role authenticated;
select throws_ok($$select pg_temp.check_lease()$$,'P0001','INVALID_STATE_TRANSITION','revoked client denies continuation');
reset role;
update public.api_clients set status='active' where id=pg_temp.lid(40);
-- Append a historical expired attempt as an isolated fixture, without changing immutable rows or waiting.
insert into public.idempotency_records(id,tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
 values(pg_temp.lid(800),pg_temp.lid(20),'user',pg_temp.lid(1),'fixture','expired',repeat('a',64),pg_temp.lid(900));
insert into private.flexexa_identity_execution_leases(id,tenant_id,request_id,generation,session_id,idempotency_record_id,created_at,expires_at)
 select pg_temp.lid(801),pg_temp.lid(20),(body->>'resource_id')::uuid,2,pg_temp.lid(101),pg_temp.lid(800),clock_timestamp()-interval '1 minute',clock_timestamp()-interval '40 seconds' from lease_results where name='intent';
insert into lease_results values('expired',jsonb_build_object('resource_id',pg_temp.lid(801)));
set local role authenticated;
select throws_ok($$select pg_temp.check_lease()$$,'P0001','INVALID_STATE_TRANSITION','higher generation fences old lease even before its expiry');
select throws_ok($$select pg_temp.check_lease('expired')$$,'P0001','INVALID_STATE_TRANSITION','expired latest lease denied');
select throws_ok($$select pg_temp.acquire()$$,'P0001','INVALID_STATE_TRANSITION','historical key cannot reclaim a new generation');
insert into lease_results values('recovered',pg_temp.acquire('recovered'));
select is((select body->>'generation' from lease_results where name='recovered'),'3','recovery increases generation');
select is(pg_temp.check_lease('recovered')->>'intended_auth_user_id',(select body->>'intended_auth_user_id' from lease_results where name='intent'),'recovery retains exact reserved identity');
select throws_ok($$select pg_temp.check_lease()$$,'P0001','INVALID_STATE_TRANSITION','recovered attempt keeps old worker fenced');
reset role;
update public.api_clients set expires_at=clock_timestamp()-interval '1 second' where id=pg_temp.lid(40);
set local role authenticated;
select throws_ok($$select pg_temp.check_lease('recovered')$$,'P0001','INVALID_STATE_TRANSITION','expired client denies even newest lease');
select throws_ok($$select pg_temp.acquire('recovered')$$,'P0001','INVALID_STATE_TRANSITION','expired client denies lease replay');
reset role;
select * from finish();
rollback;
