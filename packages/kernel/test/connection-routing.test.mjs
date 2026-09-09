import test from 'node:test';
import assert from 'node:assert/strict';
import { selectConnectionRoute, providerRetryDisposition } from '../src/connection-routing.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),asset_id:id(2),environment:'sandbox'},now='2026-09-09T12:00:00Z';
const policy={policy_set_version_id:id(9),max_state_age_ms:60000,max_connectivity_age_ms:60000,max_capability_age_ms:60000,allow_degraded:false};
const route=(n=3,patch={})=>({...scope,connection_id:id(n),provider_id:id(4),provider_account_id:id(5),provider_key:'enode',external_asset_id:'external-vehicle',priority:10,connection_status:'connected',account_status:'connected',provider_status:'active',health:'healthy',capabilities:['read_soc','start_charge'],capabilities_verified_at:now,last_seen_at:now,state_observed_at:now,valid_from:'2026-09-01T00:00:00Z',valid_until:null,...patch});
const select=(candidates,overrides={},capability='start_charge')=>selectConnectionRoute(scope,capability,now,candidates,{...policy,...overrides});
test('direct/OCPP routes work without any Enode route being present',()=>{
 for(const provider_key of ['ocpp','tesla','flexexa_simulator'])assert.equal(select([route(3,{provider_key})]).selected_route.provider_key,provider_key);
});
test('route changes preserve the canonical asset identity and recorded policy version',()=>{
 const a=select([route(3)]),b=select([route(4,{provider_key:'ocpp',provider_account_id:id(7)})]);
 assert.equal(a.selected_route.asset_id,b.selected_route.asset_id);assert.equal(a.policy_set_version_id,policy.policy_set_version_id);
});
test('higher preference means lower priority value, never an implicit Enode preference',()=>{
 const result=select([route(3),route(4,{provider_key:'ocpp',priority:0})]);assert.equal(result.selected_route.connection_id,id(4));
});
test('equal scores use stable IDs independent of input order',()=>{
 const a=route(3),b=route(4);assert.deepEqual(select([a,b]),select([b,a]));
});
test('degraded routes need explicit policy permission and lose to a healthy route',()=>{
 assert.equal(select([route(3,{health:'degraded'})]).decision,'deny');
 assert.equal(select([route(3,{health:'degraded'})],{allow_degraded:true}).decision,'select');
 assert.equal(select([route(3,{health:'degraded',priority:0}),route(4)],{allow_degraded:true}).selected_route.connection_id,id(4));
});
test('revoked, suspended and unknown-health candidates cannot be selected',()=>{
 for(const patch of [{connection_status:'revoked'},{account_status:'revoked'},{provider_status:'suspended'},{health:'unknown'},{health:'unavailable'}])assert.equal(select([route(3,patch)]).decision,'deny');
});
test('all candidates must belong to the authorized tenant and asset, even if a good one exists',()=>{
 assert.throws(()=>select([route(3),route(4,{tenant_id:id(20)})]),{code:'TENANT_MISMATCH'});
 assert.throws(()=>select([route(3),route(4,{asset_id:id(20)})]),{code:'PERMISSION_DENIED'});
});
test('duplicate candidate IDs are rejected rather than selected nondeterministically',()=>{
 assert.throws(()=>select([route(3),route(3,{provider_key:'ocpp'})]));
});
test('half-open validity includes start and excludes end',()=>{
 assert.equal(select([route(3,{valid_from:now})]).decision,'select');
 assert.equal(select([route(3,{valid_until:now})]).decision,'deny');
 assert.equal(select([route(3,{valid_from:'2026-09-09T12:00:01Z'})]).decision,'deny');
});
test('new cloud connectivity does not refresh stale device telemetry',()=>{
 const result=select([route(3,{state_observed_at:'2026-09-09T11:00:00Z'})]);
 assert.equal(result.decision,'deny');assert.equal(result.rejected[0].reason,'STALE_TELEMETRY');
});
test('read routes can recover stale state without granting control',()=>{
 const candidate=route(3,{state_observed_at:null});
 assert.equal(select([candidate],{},'read_soc').decision,'select');assert.equal(select([candidate]).decision,'deny');
});
test('freshness limits exclude their exact boundary, absent values and future values',()=>{
 for(const field of ['last_seen_at','state_observed_at','capabilities_verified_at']) {
  for(const value of [null,'2026-09-09T11:59:00Z','2026-09-09T12:00:00.001Z'])assert.equal(select([route(3,{[field]:value})]).decision,'deny');
  assert.equal(select([route(3,{[field]:'2026-09-09T11:59:00.001Z'})]).decision,'select');
 }
});
test('unsupported commands and invalid policy configuration cannot select a route',()=>{
 assert.equal(select([route(3,{capabilities:['read_soc']})]).decision,'deny');
 for(const patch of [{max_state_age_ms:Infinity},{max_connectivity_age_ms:0},{max_capability_age_ms:-1},{allow_degraded:'true'},{policy_set_version_id:'fake'}])assert.throws(()=>select([route(3)],patch));
});
test('empty inventory denies and returns no fabricated provider',()=>{assert.equal(select([]).decision,'deny');assert.equal(select([]).selected_route,null);});
test('timeouts, acceptance and terminal failure all pin reconciliation to the existing route',()=>{
 for(const state of ['delivery_unknown','accepted','terminal_failure'])assert.equal(providerRetryDisposition(state),'reconcile_pinned_route');
 assert.equal(providerRetryDisposition('definitely_not_sent'),'revalidate_before_new_route');
 assert.equal(providerRetryDisposition('measurement_confirmed'),'no_retry');assert.throws(()=>providerRetryDisposition('timeout_is_safe'));
});

test('sandbox routes cannot enter a production planning scope, even alongside a valid route',()=>{
 assert.throws(()=>select([route(3),route(4,{environment:'production'})]),{code:'PERMISSION_DENIED'});
});
