import test from 'node:test';
import assert from 'node:assert/strict';
import { selectConnectionRoute } from '../src/connection-routing.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),asset_id:id(2),environment:'sandbox'},now='2026-09-09T12:00:00Z';
const policy={policy_set_version_id:id(9),max_state_age_ms:60000,max_connectivity_age_ms:60000,max_capability_age_ms:60000,allow_degraded:false};
const route=(n=3,patch={})=>({...scope,connection_id:id(n),provider_id:id(4),provider_account_id:id(5),provider_key:'ocpp',external_asset_id:'external-vehicle',priority:10,connection_status:'connected',account_status:'connected',provider_status:'active',health:'healthy',capabilities:['read_soc'],capabilities_verified_at:now,last_seen_at:now,state_observed_at:now,valid_from:'2026-09-01T00:00:00Z',valid_until:null,...patch});
test('sandbox routes cannot participate in production decisions, even after a valid candidate',()=>{
 const production={...scope,environment:'production'};
 assert.throws(()=>selectConnectionRoute(production,'read_soc',now,[route(8,{environment:'production'}),route()],policy),{code:'PERMISSION_DENIED'});
});
test('even an empty route set validates its explicit environment',()=>{
 assert.throws(()=>selectConnectionRoute({...scope,environment:undefined},'read_soc',now,[],policy));
});
