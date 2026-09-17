import test from 'node:test';
import assert from 'node:assert/strict';
import { connectEnvironment, parseProviderBinding, parseConnectionRoute, providerExternalIdentity } from '../src/connect.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),asset_id:id(2),environment:'sandbox'};
const binding={...scope,connection_id:id(3),provider_id:id(4),provider_account_id:id(5),provider_key:'ocpp',external_asset_id:'001'};
const route={...binding,priority:1,connection_status:'pending',account_status:'pending',provider_status:'suspended',health:'unknown',capabilities:[],capabilities_verified_at:null,last_seen_at:null,state_observed_at:null,valid_from:'2026-09-09T12:00:00.000Z',valid_until:null};
for(const bad of [undefined,null,'','prod','Sandbox','PRODUCTION','production ',true,{},'sandbox\n'])test(`environment rejects ${JSON.stringify(bad)}`,()=>assert.throws(()=>connectEnvironment(bad),{code:'VALIDATION_ERROR'}));
for(const environment of ['sandbox','production'])test(`${environment} remains explicit in bindings and canonical routes`,()=>{
 const expected={...scope,environment};
 assert.equal(parseProviderBinding({...binding,environment},expected).environment,environment);
 assert.equal(parseConnectionRoute({...route,environment},expected).environment,environment);
});
test('both directions of cross-environment binding are denied',()=>{
 assert.throws(()=>parseProviderBinding({...binding,environment:'production'},scope),{code:'PERMISSION_DENIED'});
 assert.throws(()=>parseProviderBinding(binding,{...scope,environment:'production'}),{code:'PERMISSION_DENIED'});
});
test('missing environment never falls back to production in source or context',()=>{
 const {environment:_ignored,...missing}=binding;
 assert.throws(()=>parseProviderBinding(missing,scope));
 assert.throws(()=>parseProviderBinding(binding,{tenant_id:scope.tenant_id,asset_id:scope.asset_id}));
});
test('identical provider identifiers in sandbox and production have distinct canonical identity tuples',()=>{
 assert.notEqual(providerExternalIdentity(binding),providerExternalIdentity({...binding,environment:'production'}));
});
test('PostgreSQL integer priority limits match the canonical parser',()=>{
 assert.equal(parseConnectionRoute({...route,priority:2147483647},scope).priority,2147483647);
 for(const priority of [2147483648,Number.MAX_SAFE_INTEGER])assert.throws(()=>parseConnectionRoute({...route,priority},scope));
});
