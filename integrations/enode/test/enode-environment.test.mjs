import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEnodeSoc } from '../src/normalize-soc.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),asset_id:id(2),environment:'sandbox'};
const binding={...scope,connection_id:id(3),provider_id:id(4),provider_account_id:id(5),provider_key:'enode',external_asset_id:'vehicle-7'};
const now='2026-09-09T12:00:00Z';
const vehicle={id:'vehicle-7',userId:'opaque-enode-user',isReachable:true,lastSeen:now,chargeState:{batteryLevel:38,lastUpdated:'2026-09-09T11:00:00Z'}};
const normalize=(value=vehicle,b=binding,s=scope)=>normalizeEnodeSoc(value,b,s,'opaque-enode-user',now);
test('Enode observations preserve the explicit provider environment',()=>{
 const result=normalize();
 assert.equal(result.environment,'sandbox');assert.equal(result.source.environment,'sandbox');
 assert.equal(result.normalizer_version,'enode-soc/2');
 assert.equal(normalize(vehicle,{...binding,environment:'production'},{...scope,environment:'production'}).environment,'production');
});
test('valid Enode user and vehicle IDs do not bypass environment isolation',()=>{
 assert.throws(()=>normalize(vehicle,binding,{...scope,environment:'production'}),{code:'PERMISSION_DENIED'});
});
