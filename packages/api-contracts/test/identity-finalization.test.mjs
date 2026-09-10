import test from 'node:test';
import assert from 'node:assert/strict';
import {identityProvisioningFinalizationRpc,parseIdentityProvisioningCompletion,createIdentityProvisioningFinalizationApi} from '../src/identity-administration.ts';
const id=n=>`cf200000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),environment:'sandbox'};
const request=()=>({tenant_id:id(1),payload:{lease_id:id(2),environment:'sandbox'},idempotency_key:'complete-1',correlation_id:id(3)});
const receipt=()=>({tenant_id:id(1),resource_type:'identity_provisioning_completion',resource_id:id(4),request_id:id(5),lease_id:id(2),
 principal_id:id(6),generation:2,environment:'sandbox',correlation_id:id(7),idempotency_key:'complete-1',status:'completed'});
test('finalization sends exact scoped RPC and preserves original completion correlation',async()=>{
 let calls=0;const context={...scope};const api=createIdentityProvisioningFinalizationApi({rpc:async(name,args)=>{
  calls++;assert.equal(name,'flexexa_finalize_identity_provisioning');
  assert.deepEqual(args,{p_tenant_id:id(1),p_payload:request().payload,p_idempotency_key:'complete-1',p_correlation_id:id(3)});
  assert(Object.isFrozen(args));assert(Object.isFrozen(args.p_payload));return {data:receipt(),error:null};
 }},context);
 context.tenant_id=id(99);context.environment='production';
 const result=await api.finalize(request());assert.deepEqual(result,receipt());assert(Object.isFrozen(result));
 assert.equal(calls,1);assert.deepEqual(Object.keys(api),['finalize']);assert(Object.isFrozen(api));
});
for(const [name,change] of [
 ['foreign tenant',v=>({...v,tenant_id:id(99)})],['foreign environment',v=>({...v,payload:{...v.payload,environment:'production'}})],
 ['chosen subject',v=>({...v,payload:{...v.payload,auth_user_id:id(99)}})],['chosen client',v=>({...v,payload:{...v.payload,api_client_id:id(99)}})],
 ['credential',v=>({...v,payload:{...v.payload,secret:'hidden'}})],['chosen actor',v=>({...v,actor_id:id(99)})],
 ['bad lease',v=>({...v,payload:{...v.payload,lease_id:'bad'}})],['bad key',v=>({...v,idempotency_key:'bad\n'})],
])test(`finalization rejects ${name} before I/O`,async()=>{
 let calls=0;const api=createIdentityProvisioningFinalizationApi({rpc:async()=>{calls++;throw Error();}},scope);
 await assert.rejects(api.finalize(change(request())));assert.equal(calls,0);
});
for(const [field,value] of [['tenant_id',id(99)],['lease_id',id(99)],['resource_type','machine_principal'],['status','active'],['resource_id','bad'],
 ['request_id','bad'],['principal_id','bad'],['generation',0],['generation','2'],['generation',2147483648],['environment','production'],['correlation_id','bad'],['idempotency_key','other'],['secret','hidden']])
 test(`completion rejects changed/invalid ${field}: ${String(value)}`,()=>assert.throws(()=>parseIdentityProvisioningCompletion({...receipt(),[field]:value},identityProvisioningFinalizationRpc(request(),scope))));
test('finalization sanitizes errors and never retries or compensates',async()=>{
 for(const code of ['PERMISSION_DENIED','INVALID_STATE_TRANSITION','IDEMPOTENCY_CONFLICT','INTERNAL_ERROR']){
  let calls=0;const api=createIdentityProvisioningFinalizationApi({rpc:async()=>{
   calls++;if(code==='INTERNAL_ERROR')throw Error('secret');return {data:null,error:{code:'P0001',message:code,details:'secret'}};
  }},scope);
  await assert.rejects(api.finalize(request()),e=>e.code===code&&e.message===code);assert.equal(calls,1);
 }
});
test('malformed responses and incomplete trusted scope fail closed',async()=>{
 for(const data of [null,true,[],{}])await assert.rejects(createIdentityProvisioningFinalizationApi({rpc:async()=>({data,error:null})},scope).finalize(request()));
 assert.throws(()=>createIdentityProvisioningFinalizationApi({rpc:async()=>null},{tenant_id:id(1)}));
});
