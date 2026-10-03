begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.cid(n integer) returns uuid language sql immutable as $$select ('ce900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid$$;
create temp table consent_results(name text primary key,body jsonb);
grant all on consent_results to authenticated;
create function pg_temp.grant_consent(p jsonb default '{}',k text default 'grant-1') returns jsonb language sql as $$
 select public.flexexa_grant_consent(pg_temp.cid(20),jsonb_build_object('customer_id',pg_temp.cid(40),'site_id',pg_temp.cid(50),'asset_id',pg_temp.cid(60),
  'environment','sandbox','consent_type','remote_control','policy_version','consent.remote.v1','valid_until','2099-01-01T00:00:00.000Z',
  'source','signed_document','evidence_reference','evidence:fixture','evidence_sha256',repeat('a',64))||p,k,pg_temp.cid(900))
$$;
create function pg_temp.revoke_consent(p jsonb default '{}',k text default 'revoke-1') returns jsonb language sql as $$
 select public.flexexa_revoke_consent(pg_temp.cid(20),jsonb_build_object('consent_id',(select body->>'resource_id' from consent_results where name='grant'),
  'environment','sandbox','reason_code','customer_request')||p,k,pg_temp.cid(901))
$$;
create function pg_temp.check_consent(p jsonb default '{}') returns jsonb language sql as $$
 select public.flexexa_check_consent(pg_temp.cid(20),jsonb_build_object('consent_id',(select body->>'resource_id' from consent_results where name='grant'),
  'customer_id',pg_temp.cid(40),'site_id',pg_temp.cid(50),'asset_id',pg_temp.cid(60),'environment','sandbox',
  'consent_type','remote_control','policy_version','consent.remote.v1')||p)
$$;
insert into auth.users(id,email) values(pg_temp.cid(1),'consent-admin@example.invalid'),(pg_temp.cid(2),'consent-viewer@example.invalid'),(pg_temp.cid(3),'consent-other@example.invalid');
insert into public.organizations(id,name,slug) values(pg_temp.cid(10),'Consent test','consent-test');
insert into public.tenants(id,organization_id,name,slug) values(pg_temp.cid(20),pg_temp.cid(10),'Consent A','consent-a'),(pg_temp.cid(21),pg_temp.cid(10),'Consent B','consent-b');
insert into public.memberships(id,tenant_id,user_id) values(pg_temp.cid(30),pg_temp.cid(20),pg_temp.cid(1)),(pg_temp.cid(31),pg_temp.cid(20),pg_temp.cid(2)),(pg_temp.cid(32),pg_temp.cid(21),pg_temp.cid(3));
insert into public.membership_roles(tenant_id,membership_id,role_id)
 select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id
 where (m.id in (pg_temp.cid(30),pg_temp.cid(32)) and r.role_key='tenant_admin') or (m.id=pg_temp.cid(31) and r.role_key='viewer');
insert into public.customers(id,tenant_id,customer_type,display_name,status) values
 (pg_temp.cid(40),pg_temp.cid(20),'person','Owned','active'),(pg_temp.cid(41),pg_temp.cid(21),'person','Other','active'),(pg_temp.cid(42),pg_temp.cid(20),'person','Sibling','active'),(pg_temp.cid(43),pg_temp.cid(20),'person','Archived','archived');
insert into public.sites(id,tenant_id,customer_id,name) values(pg_temp.cid(50),pg_temp.cid(20),pg_temp.cid(40),'Owned'),(pg_temp.cid(51),pg_temp.cid(21),pg_temp.cid(41),'Other'),(pg_temp.cid(52),pg_temp.cid(20),pg_temp.cid(42),'Sibling');
insert into public.assets(id,tenant_id,customer_id,site_id,asset_type,display_name) values
 (pg_temp.cid(60),pg_temp.cid(20),pg_temp.cid(40),pg_temp.cid(50),'ev','Owned'),(pg_temp.cid(61),pg_temp.cid(21),pg_temp.cid(41),pg_temp.cid(51),'ev','Other'),(pg_temp.cid(62),pg_temp.cid(20),pg_temp.cid(42),pg_temp.cid(52),'ev','Sibling');
select ok((select relrowsecurity from pg_class where oid='public.consents'::regclass),'consents RLS enabled');
select ok(not has_table_privilege('anon','public.consents','SELECT'),'anon cannot read consent');
select ok(not has_column_privilege('authenticated','public.consents','evidence_json','SELECT'),'documents and evidence references hidden');
select ok(not has_column_privilege('authenticated','public.consents','granted_by','SELECT'),'grantor identity hidden');
select ok(not has_function_privilege('anon','public.flexexa_grant_consent(uuid,jsonb,text,uuid)','EXECUTE'),'anon cannot grant');
select ok(not has_function_privilege('anon','public.flexexa_revoke_consent(uuid,jsonb,text,uuid)','EXECUTE'),'anon cannot revoke');
select ok(not has_function_privilege('anon','public.flexexa_check_consent(uuid,jsonb)','EXECUTE'),'anon cannot check');
select ok(not has_function_privilege('authenticated','private.flexexa_normalize_consent_input(text,jsonb)','EXECUTE'),'normalizer not exposed');
select ok(not has_function_privilege('authenticated','private.flexexa_consent_owner_active(uuid,jsonb)','EXECUTE'),'owner lock helper not exposed');
create function pg_temp.raw_consent(c uuid,s uuid,a uuid) returns void language sql as $$
 insert into public.consents(tenant_id,customer_id,site_id,asset_id,environment,consent_type,policy_version,valid_until,granted_by,source,evidence_json)
 values(pg_temp.cid(20),c,s,a,'sandbox','location','consent.location.v1','2099-01-01T00:00:00Z',pg_temp.cid(1),'signed_document',jsonb_build_object('reference','evidence:fixture','sha256',repeat('a',64)))
$$;
select throws_ok($$select pg_temp.raw_consent(pg_temp.cid(41),null,null)$$,'23503',null,'composite customer FK rejects other tenant even for privileged inserts');
select throws_ok($$select pg_temp.raw_consent(pg_temp.cid(40),pg_temp.cid(52),null)$$,'23503',null,'composite site FK rejects sibling owner even for privileged inserts');
select throws_ok($$select pg_temp.raw_consent(pg_temp.cid(40),pg_temp.cid(50),pg_temp.cid(62))$$,'23503',null,'composite asset FK rejects sibling owner even for privileged inserts');
select throws_ok($$select pg_temp.raw_consent(pg_temp.cid(40),null,pg_temp.cid(60))$$,'23514',null,'null site cannot bypass asset ownership FK');
select is((select count(*) from pg_proc where oid in ('public.flexexa_grant_consent(uuid,jsonb,text,uuid)'::regprocedure,'public.flexexa_revoke_consent(uuid,jsonb,text,uuid)'::regprocedure,'public.flexexa_check_consent(uuid,jsonb)'::regprocedure) and not prosecdef),3::bigint,'public wrappers are invokers');
select is((select count(*) from pg_proc where proname in ('flexexa_normalize_consent_input','flexexa_consent_owner_active','flexexa_mutate_consent','flexexa_check_consent') and 'search_path=""'=any(proconfig)),5::bigint,'all helpers have fixed empty search_path');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid(1),'role','authenticated','aal','aal1')::text,true);
select throws_ok($$select pg_temp.grant_consent()$$,'42501','PERMISSION_DENIED','grant requires MFA');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid(1),'role','authenticated','aal','aal2')::text,true);
insert into consent_results values('grant',pg_temp.grant_consent());
select is((select body->>'status' from consent_results where name='grant'),'granted','evidence recorded');
select is((select count(id) from public.consents),1::bigint,'one consent record');
select is((select scope_type from public.consents),'asset','exact asset scope');
select is(pg_temp.grant_consent(),(select body from consent_results where name='grant'),'idempotent grant');
select is(pg_temp.check_consent()->>'valid','true','current exact consent valid');
select is(pg_temp.check_consent()->>'reason_code','valid','decision reason explicit');
select is(pg_temp.check_consent('{"environment":"production"}')->>'valid','false','sandbox consent cannot authorize production');
select is(pg_temp.check_consent('{"consent_type":"flex_participation"}')->>'valid','false','remote control is not flex consent');
select is(pg_temp.check_consent('{"policy_version":"consent.remote.v2"}')->>'valid','false','policy version pinned');
select is(pg_temp.check_consent(jsonb_build_object('consent_id',pg_temp.cid(999)))->>'valid','false','unknown consent denied');
select is(pg_temp.check_consent('{"asset_id":null}')->>'valid','false','asset consent cannot become site consent');
select throws_ok($$select pg_temp.grant_consent('{"policy_version":"other"}')$$,'P0001','IDEMPOTENCY_CONFLICT','changed policy conflicts with receipt');
select throws_ok($$select pg_temp.grant_consent('{"evidence_sha256":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}')$$,'P0001','IDEMPOTENCY_CONFLICT','changed evidence conflicts with receipt');
select throws_ok($$select pg_temp.grant_consent('{}','overlap')$$,'P0001','INVALID_STATE_TRANSITION','overlapping same scope denied even under another key');
select throws_ok($$select pg_temp.grant_consent('{"valid_until":"2000-01-01T00:00:00.000Z"}','past')$$,'P0001','VALIDATION_ERROR','expired grant denied');
select throws_ok($$select pg_temp.grant_consent(jsonb_build_object('customer_id',pg_temp.cid(41)),'cross-owner')$$,'P0001','TENANT_MISMATCH','cross tenant customer denied');
select throws_ok($$select pg_temp.grant_consent(jsonb_build_object('site_id',pg_temp.cid(52)),'site-owner')$$,'P0001','TENANT_MISMATCH','same tenant other customer site denied');
select throws_ok($$select pg_temp.grant_consent(jsonb_build_object('asset_id',pg_temp.cid(62)),'asset-owner')$$,'P0001','TENANT_MISMATCH','same tenant other customer asset denied');
select throws_ok($$select pg_temp.grant_consent(jsonb_build_object('customer_id',pg_temp.cid(43),'site_id',null,'asset_id',null),'archived')$$,'P0001','INVALID_STATE_TRANSITION','inactive owner cannot grant');
select throws_ok($$select pg_temp.grant_consent('{"actor_id":"spoof"}','actor')$$,'P0001','VALIDATION_ERROR','actor cannot be supplied');
select throws_ok($$select pg_temp.grant_consent('{"evidence_reference":"https://private.example/customer"}','pii')$$,'P0001','VALIDATION_ERROR','evidence URI/PII rejected');
select throws_ok($$select pg_temp.grant_consent('{"asset_id":null,"site_id":null,"valid_until":"infinity"}','infinite')$$,'P0001','VALIDATION_ERROR','infinite consent rejected');
select throws_ok($$select pg_temp.grant_consent('{}',E'bad\n')$$,'P0001','VALIDATION_ERROR','unsafe idempotency key denied');
select throws_ok($$select public.flexexa_grant_consent(pg_temp.cid(21),'{}','cross',pg_temp.cid(900))$$,'42501','PERMISSION_DENIED','cross tenant mutation denied');
select throws_ok($$update public.consents set status='revoked'$$,'42501',null,'direct writes denied');
select throws_ok($$delete from public.consents$$,'42501',null,'direct delete denied');
select throws_ok($$select evidence_json from public.consents$$,'42501',null,'sensitive evidence unreadable');
select throws_ok($$select pg_temp.revoke_consent('{"environment":"production"}','wrong-env')$$,'P0001','TENANT_MISMATCH','revocation cannot cross environment');
insert into consent_results values('site',pg_temp.grant_consent('{"asset_id":null}','site'));
insert into consent_results values('customer',pg_temp.grant_consent('{"site_id":null,"asset_id":null}','customer'));
insert into consent_results values('flex',pg_temp.grant_consent('{"consent_type":"flex_participation"}','flex'));
select is((select count(id) from public.consents),4::bigint,'independent scopes and purposes coexist');
select is(pg_temp.check_consent(jsonb_build_object('consent_id',(select body->>'resource_id' from consent_results where name='customer')))->>'valid','false','customer consent does not silently authorize an asset');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid(2),'role','authenticated','aal','aal2')::text,true);
select is((select count(id) from public.consents),4::bigint,'viewer reads scoped status');
select is(pg_temp.check_consent()->>'valid','true','viewer may inspect prerequisite but gains no control rights');
select throws_ok($$select pg_temp.grant_consent()$$,'42501','PERMISSION_DENIED','viewer cannot replay grant');
select throws_ok($$select pg_temp.revoke_consent()$$,'42501','PERMISSION_DENIED','viewer cannot revoke');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid(3),'role','authenticated','aal','aal2')::text,true);
select is((select count(id) from public.consents),0::bigint,'other tenant cannot read records');
select throws_ok($$select pg_temp.check_consent()$$,'42501','PERMISSION_DENIED','other tenant cannot check');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid(1),'role','authenticated','aal','aal2','is_anonymous',true)::text,true);
select throws_ok($$select pg_temp.grant_consent()$$,'42501','PERMISSION_DENIED','anonymous authenticated grant denied');
reset role;
select is((select count(*) from public.idempotency_records where tenant_id=pg_temp.cid(20)),4::bigint,'all failed writes rolled back receipts');
select throws_ok($$update public.consents set tenant_id=pg_temp.cid(21)$$,'23514','CONSENT_HISTORY_IMMUTABLE','ownership immutable even to privileged updates');
select throws_ok($$update public.consents set evidence_json=jsonb_build_object('reference','different','sha256',repeat('b',64))$$,'23514','CONSENT_HISTORY_IMMUTABLE','evidence immutable');
select throws_ok($$delete from public.consents$$,'23514','CONSENT_HISTORY_IMMUTABLE','history cannot be deleted');
insert into consent_results select 'snapshot',to_jsonb(c) from public.consents c where id=(select (body->>'resource_id')::uuid from consent_results where name='grant');
update public.customers set status='archived' where id=pg_temp.cid(40);
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.cid(1),'role','authenticated','aal','aal2')::text,true);
select is(pg_temp.check_consent()->>'valid','false','archival immediately blocks consent use');
insert into consent_results values('revoke',pg_temp.revoke_consent());
select is((select body->>'status' from consent_results where name='revoke'),'revoked','archived customer can still revoke');
select is(pg_temp.revoke_consent(),(select body from consent_results where name='revoke'),'idempotent revocation');
select throws_ok($$select pg_temp.revoke_consent('{"reason_code":"security"}')$$,'P0001','IDEMPOTENCY_CONFLICT','changed revocation reason conflicts');
select throws_ok($$select pg_temp.revoke_consent('{}','new-revoke')$$,'P0001','INVALID_STATE_TRANSITION','revocation terminal');
select is(pg_temp.grant_consent(),(select body from consent_results where name='grant'),'grant receipt remains historical after revocation');
select is(pg_temp.check_consent()->>'valid','false','old grant receipt cannot authorize');
reset role;
select is((select to_jsonb(c)-array['status','revoked_at','revoked_by','revocation_reason'] from public.consents c where id=(select (body->>'resource_id')::uuid from consent_results where name='grant')),
 (select body-array['status','revoked_at','revoked_by','revocation_reason'] from consent_results where name='snapshot'),'original scope, times and evidence retained');
update public.customers set status='active' where id=pg_temp.cid(40);
set local role authenticated;
insert into consent_results values('regrant',pg_temp.grant_consent('{}','regrant'));
select isnt((select body->>'resource_id' from consent_results where name='regrant'),(select body->>'resource_id' from consent_results where name='grant'),'regrant has a new immutable ID');
select is(pg_temp.check_consent()->>'valid','false','regrant cannot resurrect queued old consent');
select is(pg_temp.check_consent(jsonb_build_object('consent_id',(select body->>'resource_id' from consent_results where name='regrant')))->>'valid','true','new explicit ID valid');
reset role;
-- Real elapsed expiry check without mutating immutable evidence or faking the clock.
insert into public.consents(id,tenant_id,customer_id,site_id,asset_id,environment,consent_type,policy_version,granted_at,valid_until,granted_by,source,evidence_json)
 values(pg_temp.cid(700),pg_temp.cid(20),pg_temp.cid(40),pg_temp.cid(50),pg_temp.cid(60),'sandbox','vehicle_api','consent.remote.v1',clock_timestamp()-interval '2 minutes',clock_timestamp()-interval '1 minute',pg_temp.cid(1),'signed_document',jsonb_build_object('reference','evidence:expired','sha256',repeat('a',64)));
set local role authenticated;
select is(pg_temp.check_consent(jsonb_build_object('consent_id',pg_temp.cid(700),'consent_type','vehicle_api'))->>'valid','false','expiry denies a still-granted row');
reset role;
select is((select count(*) from public.audit_events where tenant_id=pg_temp.cid(20)),6::bigint,'six durable audits for successful RPCs only');
select is((select count(*) from public.outbox_events where tenant_id=pg_temp.cid(20)),6::bigint,'six matching durable outbox events');
select ok(not exists(select 1 from public.idempotency_records where tenant_id=pg_temp.cid(20) and status<>'completed'),'no unfinished receipts');
select ok(not exists(select 1 from public.outbox_events where tenant_id=pg_temp.cid(20) and (payload_json ?| array['evidence_reference','evidence_sha256','customer_id','site_id','asset_id','granted_by'])),'outbox excludes evidence and ownership identifiers');
select ok(not exists(select 1 from public.audit_events where tenant_id=pg_temp.cid(20) and metadata_json ?| array['evidence_reference','evidence_sha256','customer_id']),'audit metadata excludes raw evidence');
update public.memberships set status='suspended' where id=pg_temp.cid(30);
set local role authenticated;
select throws_ok($$select pg_temp.grant_consent()$$,'42501','PERMISSION_DENIED','suspension prevents receipt replay');
select throws_ok($$select pg_temp.revoke_consent()$$,'42501','PERMISSION_DENIED','suspension prevents revocation replay');
select throws_ok($$select pg_temp.check_consent()$$,'42501','PERMISSION_DENIED','suspension prevents cached prerequisite use');
reset role;
select * from finish();
rollback;
