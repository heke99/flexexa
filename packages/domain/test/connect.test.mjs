import test from 'node:test';
import assert from 'node:assert/strict';
import { providerExternalIdentity, parseProviderBinding, parseConnectionRoute, externalIdentifier, connectCapability } from '../src/connect.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),asset_id:id(2),environment:'sandbox'};
const binding={...scope,connection_id:id(3),provider_id:id(4),provider_account_id:id(5),provider_key:'enode',external_asset_id:'vehicle:001'};
const route={...binding,priority:1,connection_status:'connected',account_status:'connected',provider_status:'active',health:'healthy',capabilities:['read_soc','start_charge'],capabilities_verified_at:'2026-09-09T12:00:00Z',last_seen_at:'2026-09-09T12:00:00Z',state_observed_at:'2026-09-09T12:00:00Z',valid_from:'2026-09-01T00:00:00Z',valid_until:null};
test('binding preserves the canonical asset ID regardless of provider',()=>{
 for(const provider_key of ['enode','ocpp','tesla','flexexa_simulator'])assert.equal(parseProviderBinding({...binding,provider_key},scope).asset_id,scope.asset_id);
});
test('provider external identities are scoped by tenant, provider and account',()=>{
 const keys=[binding,{...binding,tenant_id:id(11)},{...binding,provider_id:id(12)},{...binding,provider_account_id:id(13)}].map(providerExternalIdentity);
 assert.equal(new Set(keys).size,4);
});
test('identity tuples cannot collide through a delimiter in an external ID',()=>{
 assert.notEqual(providerExternalIdentity({...binding,external_asset_id:'a:b'}),providerExternalIdentity({...binding,external_asset_id:'b:a'}));
 assert.equal(JSON.parse(providerExternalIdentity({...binding,external_asset_id:'"],"escape'}))[4],'"],"escape');
});
test('tenant mismatch and asset mismatch are denied independently',()=>{
 assert.throws(()=>parseProviderBinding({...binding,tenant_id:id(10)},scope),{code:'TENANT_MISMATCH'});
 assert.throws(()=>parseProviderBinding({...binding,asset_id:id(10)},scope),{code:'PERMISSION_DENIED'});
});
test('external identifiers are exact and never silently trimmed',()=>{
 assert.equal(externalIdentifier('001234'),'001234');
 for(const value of [' leading','trailing ',123,'','x\n','x'.repeat(513)])assert.throws(()=>externalIdentifier(value));
});
test('unknown capabilities cannot accidentally authorize a command',()=>{
 assert.equal(connectCapability('start_charge'),'start_charge');
 for(const value of ['startCharging','admin',null])assert.throws(()=>connectCapability(value));
});
test('route snapshots enforce periods, lifecycle enums, unique capabilities and immutable output',()=>{
 const parsed=parseConnectionRoute(route,scope);assert.equal(parsed.valid_from,'2026-09-01T00:00:00.000Z');
 assert.throws(()=>parsed.capabilities.push('stop_charge'));
 for(const changes of [{valid_until:route.valid_from},{priority:NaN},{priority:-1},{priority:1.5},{health:'possibly'},{account_status:'admin'},{capabilities:['read_soc','read_soc']},{capabilities_verified_at:undefined},{privileged:true}])assert.throws(()=>parseConnectionRoute({...route,...changes},scope));
});

test('environment is mandatory and participates in identity and authorization',()=>{
 assert.notEqual(providerExternalIdentity(binding),providerExternalIdentity({...binding,environment:'production'}));
 for(const environment of [undefined,null,'dev','production'])assert.throws(()=>parseProviderBinding({...binding,environment},scope));
 assert.throws(()=>parseConnectionRoute({...route,environment:'production'},scope),{code:'PERMISSION_DENIED'});
});
