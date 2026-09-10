begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.fid(n integer) returns uuid language sql immutable as $$select ('cf200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create temp table finalization_results(name text primary key,body jsonb);
grant all on finalization_results to authenticated;
create function pg_temp.claims(n int default 1,s int default 101,extra jsonb default '{}') returns text language sql as $$
 select set_config('request.jwt.claims',(jsonb_build_object('sub',pg_temp.fid(n),'session_id',pg_temp.fid(s),'role','authenticated','aal','aal2')||extra)::text,true)
$$;
create function pg_temp.request(k text) returns jsonb language sql as $$
 select public.flexexa_request_api_identity_provisioning(pg_temp.fid(20),jsonb_build_object('api_client_id',pg_temp.fid(40),'environment','sandbox'),k,pg_temp.fid(900))
$$;
create function pg_temp.acquire(n text,k text) returns jsonb language sql as $$
 select public.flexexa_acquire_identity_execution_lease(pg_temp.fid(20),jsonb_build_object('request_id',(select body->>'resource_id' from finalization_results where name=n),'environment','sandbox'),k,pg_temp.fid(900))
$$;
create function pg_temp.finalize(n text default 'lease',k text default 'finalize',p jsonb default '{}',c uuid default pg_temp.fid(900)) returns jsonb language sql as $$
 select public.flexexa_finalize_identity_provisioning(pg_temp.fid(20),jsonb_build_object('lease_id',(select body->>'resource_id' from finalization_results where name=n),'environment','sandbox')||p,k,c)
$$;
create function pg_temp.subject(n text) returns void language sql as $$
 insert into auth.users(id,email,is_anonymous,raw_app_meta_data)
 select (body->>'intended_auth_user_id')::uuid,'finalize-'||(body->>'intended_auth_user_id')||'@example.invalid',false,
  jsonb_build_object('flexexa_machine_enrollment',jsonb_build_object('version',1,'tenant_id',pg_temp.fid(20),'api_client_id',pg_temp.fid(40),'environment','sandbox'))
 from finalization_results where name=n
$$;
insert into auth.users(id,email,is_anonymous) select pg_temp.fid(n),'finalize-admin-'||n||'@example.invalid',false from generate_series(1,2) n;
insert into auth.sessions(id,user_id) values(pg_temp.fid(101),pg_temp.fid(1)),(pg_temp.fid(102),pg_temp.fid(2)),(pg_temp.fid(103),pg_temp.fid(1));
insert into public.organizations(id,name,slug) values(pg_temp.fid(30),'Finalization','finalization-test');
insert into public.tenants(id,organization_id,name,slug) values(pg_temp.fid(20),pg_temp.fid(30),'A','finalization-a'),(pg_temp.fid(21),pg_temp.fid(30),'B','finalization-b');
insert into public.memberships(id,tenant_id,user_id) values(pg_temp.fid(31),pg_temp.fid(20),pg_temp.fid(1)),(pg_temp.fid(32),pg_temp.fid(20),pg_temp.fid(2));
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id where m.id in (pg_temp.fid(31),pg_temp.fid(32)) and r.role_key='tenant_admin';
insert into public.api_clients(id,tenant_id,client_id,name,expires_at) values(pg_temp.fid(40),pg_temp.fid(20),'finalization-a','A',now()+interval '1 hour');
select ok(not has_function_privilege('anon','public.flexexa_finalize_identity_provisioning(uuid,jsonb,text,uuid)','EXECUTE'),'anonymous finalization forbidden');
select ok(not has_table_privilege('authenticated','private.flexexa_identity_provisioning_completions','SELECT'),'completions not browser-readable');
select ok(not has_table_privilege('authenticated','private.flexexa_identity_provisioning_completions','INSERT'),'completions not browser-writable');
select ok((select relrowsecurity from pg_class where oid='private.flexexa_identity_provisioning_completions'::regclass),'completion table has RLS');
select ok(not (select prosecdef from pg_proc where oid='public.flexexa_finalize_identity_provisioning(uuid,jsonb,text,uuid)'::regprocedure),'public wrapper is invoker');
set local role authenticated;
select pg_temp.claims();
insert into finalization_results values('intent',pg_temp.request('intent')),('late-intent',pg_temp.request('late-intent'));
insert into finalization_results values('lease',pg_temp.acquire('intent','lease')),('late-lease',pg_temp.acquire('late-intent','late-lease'));
select throws_ok($$select pg_temp.finalize()$$,'42501','PERMISSION_DENIED','missing reserved Auth user denies enrollment');
select throws_ok($$select pg_temp.finalize('lease','bad','{"auth_user_id":"arbitrary"}')$$,'P0001','VALIDATION_ERROR','caller cannot substitute Auth identity');
select throws_ok($$select pg_temp.finalize('lease','bad','{"secret":"forbidden"}')$$,'P0001','VALIDATION_ERROR','credential input rejected');
select throws_ok($$select pg_temp.finalize('lease','bad','{"environment":"production"}')$$,'42501','PERMISSION_DENIED','environment cannot change');
select throws_ok($$select pg_temp.finalize('lease',E'bad\n')$$,'P0001','VALIDATION_ERROR','invalid idempotency key rejected');
select pg_temp.claims(1,101,'{"aal":"aal1"}');
select throws_ok($$select pg_temp.finalize()$$,'42501','PERMISSION_DENIED','MFA required');
select pg_temp.claims(2,102);
select throws_ok($$select pg_temp.finalize()$$,'42501','PERMISSION_DENIED','other administrator cannot adopt request');
select pg_temp.claims(1,103);
select throws_ok($$select pg_temp.finalize()$$,'P0001','INVALID_STATE_TRANSITION','other session cannot execute lease');
select pg_temp.claims();
select throws_ok($$select public.flexexa_finalize_identity_provisioning(pg_temp.fid(21),'{}','cross',pg_temp.fid(900))$$,'42501','PERMISSION_DENIED','foreign tenant denied');
reset role;
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.fid(20)),4::bigint,'failed finalization leaves neither outer nor enrollment receipts');
select is((select count(*) from private.flexexa_machine_principals where tenant_id=pg_temp.fid(20)),0::bigint,'failed finalization creates no binding');
select pg_temp.subject('intent');
update auth.users set raw_app_meta_data='{}' where id=(select (body->>'intended_auth_user_id')::uuid from finalization_results where name='intent');
set local role authenticated;
select throws_ok($$select pg_temp.finalize()$$,'42501','PERMISSION_DENIED','existing subject without trusted attestation denied');
reset role;
update auth.users set raw_app_meta_data=jsonb_build_object('flexexa_machine_enrollment',jsonb_build_object('version',1,'tenant_id',pg_temp.fid(20),'api_client_id',pg_temp.fid(40),'environment','sandbox'))
 where id=(select (body->>'intended_auth_user_id')::uuid from finalization_results where name='intent');
set local role authenticated;
insert into finalization_results values('complete',pg_temp.finalize());
select is((select body->>'status' from finalization_results where name='complete'),'completed','completion is recorded');
select is(pg_temp.finalize('lease','finalize','{}',pg_temp.fid(901)),(select body from finalization_results where name='complete'),'same key preserves completion and original correlation');
select throws_ok($$select pg_temp.finalize('late-lease')$$,'P0001','IDEMPOTENCY_CONFLICT','same key cannot target another lease');
select throws_ok($$select pg_temp.finalize('lease','another')$$,'P0001','INVALID_STATE_TRANSITION','another key cannot complete request twice');
select throws_ok($$select pg_temp.acquire('intent','new-lease')$$,'P0001','INVALID_STATE_TRANSITION','completed request cannot acquire another lease');
select throws_ok($$select public.flexexa_check_identity_execution_lease(pg_temp.fid(20),(select (body->>'resource_id')::uuid from finalization_results where name='lease'))$$,'P0001','INVALID_STATE_TRANSITION','completed lease cannot continue');
reset role;
select is((select count(*) from private.flexexa_identity_provisioning_completions where tenant_id=pg_temp.fid(20)),1::bigint,'one completion');
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.fid(20)),6::bigint,'request/lease plus enrollment/finalization receipts atomic');
select is((select count(*) from public.audit_events where tenant_id=pg_temp.fid(20)),6::bigint,'each write audited');
select is((select count(*) from public.outbox_events where tenant_id=pg_temp.fid(20)),6::bigint,'each write has outbox evidence');
select is((select auth_user_id from private.flexexa_machine_principals where tenant_id=pg_temp.fid(20)),(select (body->>'intended_auth_user_id')::uuid from finalization_results where name='intent'),'only exact reserved identity enrolled');
select is((select count(*) from public.api_client_permissions where tenant_id=pg_temp.fid(20)),0::bigint,'completion issues no API grants');
select throws_ok($$update private.flexexa_identity_provisioning_completions set lease_id=pg_temp.fid(999) where tenant_id=pg_temp.fid(20)$$,'23514','AUDIT_IMMUTABLE','completion identity immutable');
select throws_ok($$delete from private.flexexa_identity_provisioning_completions where tenant_id=pg_temp.fid(20)$$,'23514','AUDIT_IMMUTABLE','completion evidence retained');
select throws_ok($$insert into private.flexexa_identity_provisioning_completions(tenant_id,request_id,lease_id,principal_id,idempotency_record_id)
 select pg_temp.fid(21),request_id,lease_id,principal_id,idempotency_record_id from private.flexexa_identity_provisioning_completions where tenant_id=pg_temp.fid(20)$$,'23503',null,'composite ownership constraints prevent foreign completion');
update private.flexexa_machine_principals set status='revoked' where tenant_id=pg_temp.fid(20);
set local role authenticated;
select pg_temp.claims(1,103);
select is(pg_temp.finalize(),(select body from finalization_results where name='complete'),'current MFA can read historical completion after revocation without new enrollment');
reset role;
select is((select status from private.flexexa_machine_principals where tenant_id=pg_temp.fid(20)),'revoked','historical replay cannot reactivate binding');
update public.memberships set status='suspended' where id=pg_temp.fid(31);
set local role authenticated;
select throws_ok($$select pg_temp.finalize()$$,'42501','PERMISSION_DENIED','historical replay rechecks current authority');
reset role;
update public.memberships set status='active' where id=pg_temp.fid(31);
select pg_temp.subject('late-intent');
-- Force a session invalidation only AFTER enrollment. Sequence evidence survives the
-- caught rollback and proves the second fence check, not merely the first, rejected it.
create temporary sequence finalization_probe;
create function pg_temp.expire_finalizer() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform nextval('pg_temp.finalization_probe');
 update auth.sessions set not_after=statement_timestamp()-interval '1 second' where id=pg_temp.fid(101);
 return new;
end $$;
create trigger finalization_expiry_probe after insert on private.flexexa_machine_principals for each row execute function pg_temp.expire_finalizer();
set local role authenticated;
select pg_temp.claims();
select throws_ok($$select pg_temp.finalize('late-lease','late-finalize')$$,'42501','PERMISSION_DENIED','authority lost after enrollment rolls back finalization');
reset role;
select is((select last_value from finalization_probe),1::bigint,'enrollment was reached before second check rejected it');
select ok((select is_called from finalization_probe),'probe actually ran');
select is((select count(*) from private.flexexa_machine_principals where tenant_id=pg_temp.fid(20)),1::bigint,'late failure rolls back enrollment binding');
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.fid(20)),6::bigint,'late failure rolls back both receipt records');
select is((select count(*) from public.audit_events where tenant_id=pg_temp.fid(20)),6::bigint,'late failure rolls back both audit records');
select is((select count(*) from public.outbox_events where tenant_id=pg_temp.fid(20)),6::bigint,'late failure rolls back both outbox events');
select ok((select not_after is null from auth.sessions where id=pg_temp.fid(101)),'test session mutation also rolled back');
drop trigger finalization_expiry_probe on private.flexexa_machine_principals;
set local role authenticated;
select lives_ok($$select pg_temp.finalize('late-lease','late-finalize')$$,'failed key can retry after full transactional rollback');
reset role;
select * from finish();
rollback;
