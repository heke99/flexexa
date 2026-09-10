import test from 'node:test';
import assert from 'node:assert/strict';
import { machinePermissionRpc, parseMachinePermissionResult } from '../src/machine-authorization.ts';
const a='f7000000-0000-4000-8000-000000000001',b='f7000000-0000-4000-8000-000000000002';
const scope={tenant_id:a,environment:'sandbox'};
const input={...scope,permission_key:'integrations.read'};
test('machine preflight has exact canonical RPC args and immutable descriptor',()=>{
 const call=machinePermissionRpc(input,scope);
 assert.deepEqual(call,{function_name:'flexexa_machine_has_permission',args:{p_tenant_id:a,p_permission_key:'integrations.read',p_environment:'sandbox'}});
 assert(Object.isFrozen(call));assert(Object.isFrozen(call.args));
});
for(const field of ['auth_user_id','service_identity_id','api_client_id','role','session_id','effective_at','token']) {
 test(`machine preflight refuses caller-supplied ${field}`,()=>assert.throws(()=>machinePermissionRpc({...input,[field]:a},scope),{code:'VALIDATION_ERROR'}));
}
test('machine preflight rejects cross tenant',()=>assert.throws(()=>machinePermissionRpc({...input,tenant_id:b},scope)));
test('machine preflight rejects cross environment',()=>assert.throws(()=>machinePermissionRpc({...input,environment:'production'},scope),{code:'PERMISSION_DENIED'}));
for(const key of ['',null,'*','integrations.*','integrations.read\n','integrations.read\r',' Integrations.read','a'.repeat(129)]) {
 test(`machine preflight invalid permission ${JSON.stringify(key)}`,()=>assert.throws(()=>machinePermissionRpc({...input,permission_key:key},scope),{code:'VALIDATION_ERROR'}));
}
for(const value of [null,undefined,1,0,'true','false',{},[],{allowed:true},{data:true}]) {
 test(`preflight decoder rejects ${JSON.stringify(value)}`,()=>assert.throws(()=>parseMachinePermissionResult(value),{code:'VALIDATION_ERROR'}));
}
test('preflight decoder preserves both boolean decisions without truthy coercion',()=>{
 assert.equal(parseMachinePermissionResult(true),true);assert.equal(parseMachinePermissionResult(false),false);
});
