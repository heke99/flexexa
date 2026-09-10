begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.oid(n int) returns uuid language sql immutable as $$select ('be340000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.claims(n int default 1,s int default 101,extra jsonb default '{}') returns text language sql as $$
 select set_config('request.jwt.claims',(jsonb_build_object('sub',pg_temp.oid(n),'session_id',pg_temp.oid(s),'role','authenticated','aal','aal1')||extra)::text,true)
$$;
create temp table deliveries(name text primary key,body jsonb);
grant all on deliveries to authenticated;
create function pg_temp.claim_event(env text default 'sandbox',t int default 20) returns jsonb language sql as $$
 select public.flexexa_claim_outbox_event(pg_temp.oid(t),env)
$$;
create function pg_temp.finish_event(n text default 'first',outcome text default 'published') returns jsonb language sql as $$
 select public.flexexa_finish_outbox_event(pg_temp.oid(20),'sandbox',(select (body->>'lease_id')::uuid from deliveries where name=n),outcome)
$$;
insert into auth.users(id,is_anonymous) select pg_temp.oid(n),false from generate_series(1,4)n;
insert into auth.sessions(id,user_id) values(pg_temp.oid(101),pg_temp.oid(1)),(pg_temp.oid(102),pg_temp.oid(2)),(pg_temp.oid(103),pg_temp.oid(1));
insert into public.organizations(id,name,slug) values(pg_temp.oid(30),'Outbox','outbox-tests');
insert into public.tenants(id,organization_id,name,slug) values(pg_temp.oid(20),pg_temp.oid(30),'A','outbox-a'),(pg_temp.oid(21),pg_temp.oid(30),'B','outbox-b');
insert into public.service_identities(id,service_key,name) values(pg_temp.oid(40),'outbox-test','Outbox test');
insert into private.flexexa_machine_principals(id,auth_user_id,principal_type,service_identity_id,environment)
 values(pg_temp.oid(50),pg_temp.oid(1),'service',pg_temp.oid(40),'sandbox');
insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json)
 select pg_temp.oid(40),pg_temp.oid(20),id,'{"environment":"sandbox"}' from public.permissions where permission_key='events.publish';
create function pg_temp.event(n int,env text default 'sandbox',t int default 20) returns void language plpgsql as $$
declare receipt uuid; audit uuid;
begin
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
 values(pg_temp.oid(t),'user',pg_temp.oid(4),'fixture',n::text,repeat('a',64),pg_temp.oid(900)) returning id into receipt;
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id)
 values(pg_temp.oid(t),'user',pg_temp.oid(4),'fixture','fixture',pg_temp.oid(n),pg_temp.oid(900),receipt) returning id into audit;
 insert into public.outbox_events(id,tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
 values(pg_temp.oid(n),pg_temp.oid(t),pg_temp.oid(30),audit,'flexexa.fixture.created',pg_temp.oid(900),'flexexa.fixture',case when env is null then '{}'::jsonb else jsonb_build_object('environment',env) end);
end $$;
select pg_temp.event(200);
select pg_temp.event(201,'production');
select pg_temp.event(202,null);
select pg_temp.event(203,'sandbox',21);
select ok(not has_function_privilege('anon','public.flexexa_claim_outbox_event(uuid,text)','EXECUTE'),'anonymous cannot claim');
select ok(not has_function_privilege('anon','public.flexexa_finish_outbox_event(uuid,text,uuid,text)','EXECUTE'),'anonymous cannot finish');
select ok(not has_function_privilege('authenticated','private.flexexa_assert_outbox_publisher(uuid,text)','EXECUTE'),'internal auth helper private');
select ok(not has_table_privilege('authenticated','private.flexexa_outbox_leases','SELECT'),'leases private');
select ok(not has_table_privilege('authenticated','private.flexexa_outbox_delivery_results','INSERT'),'results private');
select ok(not has_table_privilege('authenticated','public.outbox_events','UPDATE'),'direct outbox writes forbidden');
select is((select count(*) from pg_class where oid in ('private.flexexa_outbox_leases'::regclass,'private.flexexa_outbox_delivery_results'::regclass) and relrowsecurity),2::bigint,'private tables have RLS');
set local role authenticated;
select pg_temp.claims(2,102);
select throws_ok($$select pg_temp.claim_event()$$,'42501','PERMISSION_DENIED','human without service binding denied');
select pg_temp.claims(1,102);
select throws_ok($$select pg_temp.claim_event()$$,'42501','PERMISSION_DENIED','wrong session denied');
select pg_temp.claims(1,101,'{"role":"service_role"}');
select throws_ok($$select pg_temp.claim_event()$$,'42501','PERMISSION_DENIED','universal key claim denied');
select pg_temp.claims(1,101,'{"is_anonymous":true}');
select throws_ok($$select pg_temp.claim_event()$$,'42501','PERMISSION_DENIED','anonymous claim denied');
select pg_temp.claims();
select throws_ok($$select pg_temp.claim_event('production')$$,'42501','PERMISSION_DENIED','wrong environment denied');
select throws_ok($$select pg_temp.claim_event('sandbox',21)$$,'42501','PERMISSION_DENIED','ungranted tenant denied');
insert into deliveries values('first',pg_temp.claim_event());
select is((select body->'event'->>'event_id' from deliveries where name='first'),pg_temp.oid(200)::text,'claims only matching environment');
select is((select body->>'generation' from deliveries where name='first'),'1','first generation assigned');
select is(pg_temp.claim_event(),null::jsonb,'active lease, other environment and unclassified events skipped');
select pg_temp.claims(1,103);
select throws_ok($$select pg_temp.finish_event()$$,'42501','PERMISSION_DENIED','other session cannot acknowledge');
select pg_temp.claims();
select throws_ok($$select pg_temp.finish_event('first','anything')$$,'P0001','VALIDATION_ERROR','unknown outcome rejected');
reset role;
update public.service_identity_tenant_grants set valid_until=clock_timestamp()-interval '1 second',valid_from=clock_timestamp()-interval '1 hour' where service_identity_id=pg_temp.oid(40);
set local role authenticated;
select throws_ok($$select pg_temp.finish_event()$$,'42501','PERMISSION_DENIED','expired grant denies continuation');
reset role;
update public.service_identity_tenant_grants set valid_until=null where service_identity_id=pg_temp.oid(40);
update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=pg_temp.oid(1);
set local role authenticated;
select throws_ok($$select pg_temp.finish_event()$$,'42501','PERMISSION_DENIED','banned service subject denied');
reset role;
update auth.users set banned_until=null where id=pg_temp.oid(1);
update public.service_identities set status='suspended' where id=pg_temp.oid(40);
set local role authenticated;
select throws_ok($$select pg_temp.finish_event()$$,'42501','PERMISSION_DENIED','suspended service denied');
reset role;
update public.service_identities set status='active' where id=pg_temp.oid(40);
set local role authenticated;
select is(pg_temp.finish_event()->>'status','published','confirmed delivery completes');
select is(pg_temp.finish_event()->>'status','published','duplicate confirmation idempotent');
select throws_ok($$select pg_temp.finish_event('first','retry')$$,'P0001','IDEMPOTENCY_CONFLICT','conflicting confirmation rejected');
reset role;
select is((select attempt_count from public.outbox_events where id=pg_temp.oid(200)),1,'one attempt');
select is((select count(*) from private.flexexa_outbox_delivery_results where tenant_id=pg_temp.oid(20)),1::bigint,'one durable result');
select throws_ok($$update public.outbox_events set status='pending',published_at=null where id=pg_temp.oid(200)$$,'23514','OUTBOX_TERMINAL','published fact cannot reopen');
select throws_ok($$update public.outbox_events set payload_json='{}' where id=pg_temp.oid(201)$$,'23514','OUTBOX_FACT_IMMUTABLE','event facts remain immutable');
select throws_ok($$delete from private.flexexa_outbox_leases where tenant_id=pg_temp.oid(20)$$,'23514','AUDIT_IMMUTABLE','attempt evidence retained');
select throws_ok($$delete from private.flexexa_outbox_delivery_results where tenant_id=pg_temp.oid(20)$$,'23514','AUDIT_IMMUTABLE','results retained');
select pg_temp.event(204);
-- Seed an expired attempt without changing time or bypassing immutable evidence.
insert into private.flexexa_outbox_leases(id,tenant_id,event_id,generation,principal_id,session_id,environment,created_at,expires_at)
 values(pg_temp.oid(800),pg_temp.oid(20),pg_temp.oid(204),1,pg_temp.oid(50),pg_temp.oid(101),'sandbox',clock_timestamp()-interval '1 minute',clock_timestamp()-interval '30 seconds');
update public.outbox_events set attempt_count=1 where id=pg_temp.oid(204);
set local role authenticated;
select throws_ok($$select public.flexexa_finish_outbox_event(pg_temp.oid(20),'sandbox',pg_temp.oid(800),'published')$$,'P0001','INVALID_STATE_TRANSITION','expired lease cannot acknowledge');
insert into deliveries values('reclaimed',pg_temp.claim_event());
select is((select body->>'generation' from deliveries where name='reclaimed'),'2','crashed attempt reclaimed with higher generation');
select throws_ok($$select public.flexexa_finish_outbox_event(pg_temp.oid(20),'sandbox',pg_temp.oid(800),'published')$$,'P0001','INVALID_STATE_TRANSITION','stale token cannot acknowledge replacement');
select is(pg_temp.finish_event('reclaimed','retry')->>'status','pending','broker failure schedules retry');
select is(pg_temp.finish_event('reclaimed','retry')->>'status','pending','retry result idempotent');
select is(pg_temp.claim_event(),null::jsonb,'retry backoff enforced');
reset role;
select ok((select available_at>clock_timestamp() from public.outbox_events where id=pg_temp.oid(204)),'backoff is in the future');
-- A final failed/crashed attempt must become terminal, never loop forever.
select pg_temp.event(205);
update public.outbox_events set attempt_count=9 where id=pg_temp.oid(205);
set local role authenticated;
insert into deliveries values('final',pg_temp.claim_event());
select is((select body->>'generation' from deliveries where name='final'),'10','last allowed attempt');
select is(pg_temp.finish_event('final','retry')->>'status','dead_letter','tenth failure becomes dead letter');
reset role;
select pg_temp.event(206);
update public.outbox_events set attempt_count=10 where id=pg_temp.oid(206);
set local role authenticated;
select is(pg_temp.claim_event(),null::jsonb,'crashed tenth attempt returns no new lease');
reset role;
select is((select status from public.outbox_events where id=pg_temp.oid(206)),'dead_letter','crashed final attempt is terminal');
select is((select count(*) from public.outbox_events where id in(pg_temp.oid(201),pg_temp.oid(202),pg_temp.oid(203)) and status='pending' and attempt_count=0),3::bigint,'foreign environment, unclassified and foreign tenant untouched');
update private.flexexa_machine_principals set status='revoked' where id=pg_temp.oid(50);
set local role authenticated;
select throws_ok($$select pg_temp.finish_event()$$,'42501','PERMISSION_DENIED','replay requires current authorization after revocation');
reset role;
select * from finish();
rollback;
