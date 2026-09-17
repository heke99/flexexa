import test from 'node:test';
import assert from 'node:assert/strict';
import { parseConnectionRouteRead, connectionRouteReadRpc, parseConnectionRouteReadResult } from '../src/connect-registry.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),asset_id:id(2),environment:'production'};
const route=(n=3,patch={})=>({...scope,connection_id:id(n),provider_id:id(4),provider_account_id:id(5),provider_key:'ocpp',external_asset_id:'vehicle-1',priority:0,connection_status:'pending',account_status:'pending',provider_status:'suspended',health:'unknown',capabilities:[],capabilities_verified_at:null,last_seen_at:null,state_observed_at:null,valid_from:'2026-09-09T12:00:00Z',valid_until:null,...patch});
test('read RPC is a fixed function with exact parameter names and no credentials',()=>{
 assert.deepEqual(connectionRouteReadRpc(scope,scope),{function_name:'flexexa_get_connection_routes',args:{p_tenant_id:scope.tenant_id,p_asset_id:scope.asset_id,p_environment:'production'}});
 assert(Object.isFrozen(connectionRouteReadRpc(scope,scope).args));
});
for(const [label,patch,code] of [['other tenant',{tenant_id:id(77)},'TENANT_MISMATCH'],['other asset',{asset_id:id(77)},'PERMISSION_DENIED'],['other environment',{environment:'sandbox'},'PERMISSION_DENIED'],['missing environment',{environment:undefined},'VALIDATION_ERROR'],['injected grant',{is_admin:true},'VALIDATION_ERROR'],['injected provider credential',{credential_reference:'do-not-expose'},'VALIDATION_ERROR']])test(`read request rejects ${label}`,()=>assert.throws(()=>parseConnectionRouteRead({...scope,...patch},scope),{code}));
test('empty results do not bypass validation of authenticated context',()=>{
 assert.deepEqual(parseConnectionRouteReadResult([],scope),[]);
 assert.throws(()=>parseConnectionRouteReadResult([],{...scope,environment:undefined}));
});
test('read result retains provider-neutral canonical identity without granting connectivity',()=>{
 const result=parseConnectionRouteReadResult([route()],scope);
 assert.equal(result[0].asset_id,scope.asset_id);assert.equal(result[0].connection_status,'pending');
 assert(Object.isFrozen(result));assert(Object.isFrozen(result[0]));assert(Object.isFrozen(result[0].capabilities));
});
for(const [label,patch] of [['tenant',{tenant_id:id(77)}],['asset',{asset_id:id(77)}],['environment',{environment:'sandbox'}],['credential',{credential_reference:'never'}],['token',{access_token:'never'}],['unknown schema',{schema_version:999}]])test(`mixed read result rejects ${label} rather than silently dropping the bad row`,()=>assert.throws(()=>parseConnectionRouteReadResult([route(),route(9,patch)],scope)));
test('duplicate IDs and non-array results fail closed',()=>{
 for(const result of [null,{},[route(),route()]])assert.throws(()=>parseConnectionRouteReadResult(result,scope));
});
test('inventory is bounded without silently truncating candidates',()=>{
 assert.equal(parseConnectionRouteReadResult(Array.from({length:1000},(_,i)=>route(i+10)),scope).length,1000);
 assert.throws(()=>parseConnectionRouteReadResult(Array.from({length:1001},(_,i)=>route(i+10)),scope));
});

test('sparse result arrays cannot masquerade as validated routes',()=>{
 assert.throws(()=>parseConnectionRouteReadResult(new Array(1),scope),{code:'VALIDATION_ERROR'});
});
