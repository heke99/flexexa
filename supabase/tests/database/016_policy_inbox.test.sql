begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.pid(n int) returns uuid language sql immutable as $$select ('be350000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create function pg_temp.claims(n int,extra jsonb default '{}') returns text language sql as $$
 select set_config('request.jwt.claims',(jsonb_build_object('sub',pg_temp.pid(n),'session_id',pg_temp.pid(n+100),'role','authenticated','aal','aal2')||extra)::text,true)
$$;
insert into auth.users(id,is_anonymous) select pg_temp.pid(n),false from generate_series(1,4)n;
insert into auth.sessions(id,user_id) select pg_temp.pid(n+100),pg_temp.pid(n) from generate_series(1,4)n;
insert into public.platform_memberships(id,user_id) values(pg_temp.pid(11),pg_temp.pid(1)),(pg_temp.pid(12),pg_temp.pid(2));
insert into public.platform_membership_roles(platform_membership_id,role_id)
 select pm.id,r.id from public.platform_memberships pm cross join public.roles r where pm.id in(pg_temp.pid(11),pg_temp.pid(12)) and r.scope_type='platform' and r.role_key='platform_admin';
insert into public.organizations(id,name,slug) values(pg_temp.pid(30),'Policies','policy-tests');
insert into public.tenants(id,organization_id,name,slug) values(pg_temp.pid(20),pg_temp.pid(30),'A','policy-a'),(pg_temp.pid(21),pg_temp.pid(30),'B','policy-b');
insert into public.memberships(id,tenant_id,user_id) values(pg_temp.pid(41),pg_temp.pid(20),pg_temp.pid(3)),(pg_temp.pid(42),pg_temp.pid(21),pg_temp.pid(4));
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id and r.role_key='tenant_admin' where m.id in(pg_temp.pid(41),pg_temp.pid(42));
insert into public.role_permissions(tenant_id,role_id,permission_id)
 select r.tenant_id,r.id,p.id from public.roles r cross join public.permissions p where r.tenant_id in(pg_temp.pid(20),pg_temp.pid(21)) and r.role_key='tenant_admin' and p.permission_key='rules.read';
create temp table policies(name text primary key,body jsonb);
grant all on policies to authenticated;
create function pg_temp.payload(k text default 'policy.test') returns jsonb language sql as $$
 select jsonb_build_object('policy_key',k,'name','Test policy','valid_from','2026-01-01T00:00:00.000Z','valid_until','2099-01-01T00:00:00.000Z',
 'tenants',jsonb_build_array(pg_temp.pid(20)),'rules','[{"rule_key":"power.test","expression":{"minimum_kw":0,"maximum_kw":7,"deny_reasons":[]},"tests":[{"name":"inside","requested_kw":5,"expected_allowed":true},{"name":"outside","requested_kw":8,"expected_allowed":false}]}]'::jsonb)
$$;
create function pg_temp.version(n text default 'first') returns jsonb language sql as $$select jsonb_build_object('policy_set_version_id',body->'policy_set_version_id') from policies where name=n$$;
insert into auth.users(id,is_anonymous) values(pg_temp.pid(5),false),(pg_temp.pid(6),false);
insert into auth.sessions(id,user_id) values(pg_temp.pid(105),pg_temp.pid(5)),(pg_temp.pid(106),pg_temp.pid(6));
insert into public.service_identities(id,service_key,name) values(pg_temp.pid(60),'policy-consumer-test','Consumer'),(pg_temp.pid(61),'policy-publisher-test','Publisher');
insert into private.flexexa_machine_principals(id,auth_user_id,principal_type,service_identity_id,environment)
 values(pg_temp.pid(70),pg_temp.pid(5),'service',pg_temp.pid(60),'sandbox'),(pg_temp.pid(71),pg_temp.pid(6),'service',pg_temp.pid(61),'sandbox');
insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json)
 select pg_temp.pid(60),pg_temp.pid(20),id,'{"environment":"sandbox"}' from public.permissions where permission_key='events.consume';
insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json)
 select pg_temp.pid(61),pg_temp.pid(20),id,'{"environment":"sandbox"}' from public.permissions where permission_key='events.publish';
set local role authenticated;
select pg_temp.claims(1);
insert into policies values('first',public.flexexa_create_policy_set_version(pg_temp.payload(),'create',pg_temp.pid(900)));
select public.flexexa_test_policy_set_version(pg_temp.version(),'test',pg_temp.pid(900));
select public.flexexa_shadow_policy_set_version(pg_temp.version()||'{"observations":[{"requested_kw":5,"expected_allowed":true}]}','shadow',pg_temp.pid(900));
select pg_temp.claims(2);
select public.flexexa_approve_policy_set_version(pg_temp.version(),'approve',pg_temp.pid(900));
select public.flexexa_publish_policy_set_version(pg_temp.version(),'publish',pg_temp.pid(900));
reset role;
create temp table messages(name text primary key,body jsonb);
grant all on messages to authenticated;
create function pg_temp.capture(n text) returns void language sql as $$
 insert into messages select n,jsonb_build_object('event_id',e.id,'tenant_id',e.tenant_id,'organization_id',e.organization_id,'event_type',e.event_type,'event_version',e.event_version,
 'occurred_at',to_char(e.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'received_at',to_char(e.received_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'correlation_id',e.correlation_id,'causation_id',e.causation_id,'source',e.source,'payload',e.payload_json) from public.outbox_events e where e.payload_json->>'policy_set_version_id'=pg_temp.version(n)->>'policy_set_version_id'
$$;
select pg_temp.capture('first');
create function pg_temp.consume(n text default 'first') returns jsonb language sql as $$select public.flexexa_consume_policy_publication(pg_temp.pid(20),'sandbox',(select body from messages where name=n))$$;
select is((select body->>'event_type' from messages where name='first'),'policy.version.published','new publication emits locked V1 event name');
select ok(not has_function_privilege('anon','public.flexexa_consume_policy_publication(uuid,text,jsonb)','EXECUTE'),'anonymous cannot consume');
select ok(not has_function_privilege('authenticated','private.flexexa_assert_event_worker(uuid,text,text)','EXECUTE'),'worker authorization helper private');
select ok(not has_table_privilege('authenticated','public.inbox_events','INSERT'),'browser cannot forge inbox');
select ok(not has_table_privilege('service_role','public.inbox_events','INSERT'),'universal key cannot forge inbox');
select is((select count(*) from public.role_template_permissions x join public.permissions p on p.id=x.permission_id where p.permission_key='events.consume'),0::bigint,'consumer permission has no implicit role grants');
set local role authenticated;
select pg_temp.claims(2);
select throws_ok($$select pg_temp.consume()$$,'42501','PERMISSION_DENIED','human platform admin is not a consumer');
select pg_temp.claims(6);
select throws_ok($$select pg_temp.consume()$$,'42501','PERMISSION_DENIED','publish grant does not imply consume');
select pg_temp.claims(5);
select throws_ok($$select public.flexexa_consume_policy_publication(pg_temp.pid(21),'sandbox',(select body from messages where name='first'))$$,'42501','PERMISSION_DENIED','ungranted tenant denied');
select throws_ok($$select public.flexexa_consume_policy_publication(pg_temp.pid(20),'production',(select body from messages where name='first'))$$,'42501','PERMISSION_DENIED','wrong environment denied');
select throws_ok($$select public.flexexa_consume_policy_publication(pg_temp.pid(20),'sandbox',jsonb_set((select body from messages where name='first'),'{tenant_id}',to_jsonb(pg_temp.pid(21))))$$,'P0001','TENANT_MISMATCH','envelope cannot cross tenant');
select throws_ok($$select public.flexexa_consume_policy_publication(pg_temp.pid(20),'sandbox',jsonb_set((select body from messages where name='first'),'{payload,rules_checksum}',to_jsonb(repeat('b',64))))$$,'P0001','POLICY_DENIED','forged payload rejected against durable event');
select throws_ok($$select public.flexexa_consume_policy_publication(pg_temp.pid(20),'sandbox',(select body from messages where name='first')||'{"extra":true}')$$,'P0001','POLICY_DENIED','extra envelope fields rejected');
select throws_ok($$select * from public.inbox_events$$,'42501',null,'inbox is not a browser data store');
reset role;
create function pg_temp.fail_inbox_audit() returns trigger language plpgsql as $$begin if new.action='policy_readiness_evaluated' then raise exception 'FIXTURE_AUDIT_FAILURE'; end if; return new; end$$;
create trigger fixture_inbox_audit before insert on public.audit_events for each row execute function pg_temp.fail_inbox_audit();
set local role authenticated;
select throws_ok($$select pg_temp.consume()$$,'P0001','FIXTURE_AUDIT_FAILURE','audit failure aborts whole handler');
reset role;
select is((select count(*) from public.inbox_events),0::bigint,'failed transaction leaves no inbox receipt');
select is((select count(*) from public.idempotency_records where operation_key='consume_policy_publication'),0::bigint,'failed transaction leaves no idempotency receipt');
select is((select status from public.tenant_policy_readiness where tenant_id=pg_temp.pid(20)),'pending','failed transaction rolls readiness back');
drop trigger fixture_inbox_audit on public.audit_events;
set local role authenticated;
insert into policies values('consumed',pg_temp.consume());
select is((select body->>'status' from policies where name='consumed'),'processed','handler commits after retry');
select is(pg_temp.consume(),(select body from policies where name='consumed'),'duplicate returns stored result');
reset role;
select is((select count(*) from public.inbox_events),1::bigint,'one inbox entry');
select is((select count(*) from public.audit_events where action='policy_readiness_evaluated'),1::bigint,'one audited business effect');
select is((select status from public.tenant_policy_readiness where tenant_id=pg_temp.pid(20)),'blocked','sandbox readiness evaluated without production authority');
select throws_ok($$delete from public.inbox_events$$,'23514','AUDIT_IMMUTABLE','consumer evidence is append-only');
set local role authenticated;
select pg_temp.claims(1);
insert into policies values('second',public.flexexa_create_policy_set_version(pg_temp.payload(),'create2',pg_temp.pid(900)));
select public.flexexa_test_policy_set_version(pg_temp.version('second'),'test2',pg_temp.pid(900));
select public.flexexa_shadow_policy_set_version(pg_temp.version('second')||'{"observations":[{"requested_kw":5,"expected_allowed":true}]}','shadow2',pg_temp.pid(900));
select pg_temp.claims(2);
select public.flexexa_approve_policy_set_version(pg_temp.version('second'),'approve2',pg_temp.pid(900));
select public.flexexa_publish_policy_set_version(pg_temp.version('second'),'publish2',pg_temp.pid(900));
select pg_temp.claims(5);
select is(pg_temp.consume(),(select body from policies where name='consumed'),'old delivery replay retains historical receipt');
reset role;
select is((select status from public.tenant_policy_readiness where policy_set_version_id=(pg_temp.version()->>'policy_set_version_id')::uuid),'superseded','old replay cannot revive old readiness');
select is((select status from public.tenant_policy_readiness where policy_set_version_id=(pg_temp.version('second')->>'policy_set_version_id')::uuid),'pending','old replay cannot evaluate new version');
update public.service_identity_tenant_grants set valid_until=clock_timestamp()-interval '1 second',valid_from=clock_timestamp()-interval '1 hour' where service_identity_id=pg_temp.pid(60);
set local role authenticated;
select throws_ok($$select pg_temp.consume()$$,'42501','PERMISSION_DENIED','revoked grant denies even successful historical replay');
reset role;
select * from finish();
rollback;
