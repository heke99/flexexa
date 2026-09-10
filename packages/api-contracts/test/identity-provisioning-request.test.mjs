import test from 'node:test';
import assert from 'node:assert/strict';
import {identityProvisioningRequestRpc,parseIdentityProvisioningRequestReceipt,createIdentityProvisioningRequestApi} from '../src/identity-administration.ts';
const id=n=>`cf170000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),environment:'sandbox'};
const request=()=>({tenant_id:id(1),idempotency_key:'provision-1',correlation_id:id(2),payload:{api_client_id:id(3),environment:'sandbox'}});
const receipt=()=>({tenant_id:id(1),resource_type:'identity_provisioning_request',resource_id:id(4),api_client_id:id(3),
 intended_auth_user_id:id(5),environment:'sandbox',correlation_id:id(6),idempotency_key:'provision-1',status:'requested'});
test('durable request invokes exact RPC and retains original server-generated identity/correlation',async()=>{
 let calls=0;const context={...scope};const api=createIdentityProvisioningRequestApi({rpc:async(name,args)=>{
  calls++;assert.equal(name,'flexexa_request_api_identity_provisioning');
  assert.deepEqual(args,{p_tenant_id:id(1),p_payload:request().payload,p_idempotency_key:'provision-1',p_correlation_id:id(2)});
  assert(Object.isFrozen(args));assert(Object.isFrozen(args.p_payload));return {data:receipt(),error:null};
 }},context);
 context.tenant_id=id(99);context.environment='production';
 assert.deepEqual(await api.request(request()),receipt());assert.equal(calls,1);
 assert.deepEqual(Object.keys(api),['request']);assert(Object.isFrozen(api));
});
for(const [name,change] of [
 ['foreign tenant',v=>({...v,tenant_id:id(99)})],['missing environment',v=>({...v,payload:{api_client_id:id(3)}})],
 ['foreign environment',v=>({...v,payload:{...v.payload,environment:'production'}})],
 ['chosen subject',v=>({...v,payload:{...v.payload,auth_user_id:id(5)}})],
 ['secret',v=>({...v,payload:{...v.payload,secret:'hidden'}})],['metadata',v=>({...v,payload:{...v.payload,app_metadata:{}}})],
 ['chosen actor',v=>({...v,actor_id:id(99)})],['invalid client',v=>({...v,payload:{...v.payload,api_client_id:'bad'}})],
 ['newline key',v=>({...v,idempotency_key:'bad\n'})],['invalid correlation',v=>({...v,correlation_id:'bad'})],
])test(`request rejects ${name} before transport`,async()=>{
 let calls=0;const api=createIdentityProvisioningRequestApi({rpc:async()=>{calls++;throw Error();}},scope);
 await assert.rejects(api.request(change(request())));assert.equal(calls,0);
});
for(const [field,value] of [['tenant_id',id(99)],['api_client_id',id(99)],['resource_type','machine_principal'],['status','enrolled'],
 ['intended_auth_user_id','invalid'],['resource_id','invalid'],['correlation_id','invalid'],['idempotency_key','other'],['environment','production'],['secret','hidden']])
 test(`receipt rejects ${field}`,()=>assert.throws(()=>parseIdentityProvisioningRequestReceipt({...receipt(),[field]:value},identityProvisioningRequestRpc(request(),scope))));
test('transport failures and database errors do not leak details or retry',async()=>{
 for(const [error,code] of [[{code:'42501',message:'sensitive'},'PERMISSION_DENIED'],[{code:'P0001',message:'IDEMPOTENCY_CONFLICT'},'IDEMPOTENCY_CONFLICT'],[{code:'23505',message:'sensitive'},'INTERNAL_ERROR']]){
  let calls=0;const api=createIdentityProvisioningRequestApi({rpc:async()=>{calls++;return {data:receipt(),error};}},scope);
  await assert.rejects(api.request(request()),e=>e.code===code&&e.message===code);assert.equal(calls,1);
 }
 let calls=0;const api=createIdentityProvisioningRequestApi({rpc:async()=>{calls++;throw Error('secret');}},scope);
 await assert.rejects(api.request(request()),{code:'INTERNAL_ERROR',message:'INTERNAL_ERROR'});assert.equal(calls,1);
});
test('empty response and invalid trusted scope fail closed',async()=>{
 const api=createIdentityProvisioningRequestApi({rpc:async()=>({data:null,error:null})},scope);
 await assert.rejects(api.request(request()));
 assert.throws(()=>createIdentityProvisioningRequestApi({rpc:async()=>null},{tenant_id:id(1)}));
});
