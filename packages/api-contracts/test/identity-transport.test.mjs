import test from 'node:test';
import assert from 'node:assert/strict';
import {createIdentityAdministrationApi} from '../src/identity-administration.ts';
const id=n=>`ce160000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope=()=>({tenant_id:id(1),environment:'sandbox'});
const request=kind=>({tenant_id:id(1),idempotency_key:'identity-transport',correlation_id:id(2),payload:kind==='enroll'
 ?{api_client_id:id(3),auth_user_id:id(4),environment:'sandbox'}
 :{principal_id:id(5),environment:'sandbox',reason_code:'rotation'}});
const receipt=kind=>({tenant_id:id(1),resource_type:'machine_principal',resource_id:id(5),correlation_id:id(6),
 idempotency_key:'identity-transport',environment:'sandbox',status:kind==='enroll'?'enrolled':'revoked'});
for(const kind of ['enroll','revoke']) {
 test(`${kind} invokes exact RPC once and preserves historical replay correlation`,async()=>{
  let calls=0;
  const api=createIdentityAdministrationApi({rpc:async(name,args)=>{
   calls++;assert.equal(name,`flexexa_${kind}_api_client_identity`);
   assert.deepEqual(args,{p_tenant_id:id(1),p_payload:request(kind).payload,p_idempotency_key:'identity-transport',p_correlation_id:id(2)});
   assert(Object.isFrozen(args));assert(Object.isFrozen(args.p_payload));
   return {data:receipt(kind),error:null};
  }},scope());
  const result=await api[kind](request(kind));assert.deepEqual(result,receipt(kind));assert(Object.isFrozen(result));assert.equal(calls,1);
  assert.deepEqual(Object.keys(api),['enroll','revoke']);assert(Object.isFrozen(api));
 });
 test(`${kind} rejects cross-tenant, environment and credential input before I/O`,async()=>{
  let calls=0;const api=createIdentityAdministrationApi({rpc:async()=>{calls++;throw Error('unexpected');}},scope());
  for(const change of [{tenant_id:id(99)},{payload:{...request(kind).payload,environment:'production'}},
   {payload:{...request(kind).payload,secret:'sensitive'}},{actor_id:id(99)}])await assert.rejects(api[kind]({...request(kind),...change}));
  assert.equal(calls,0);
 });
 test(`${kind} snapshots trusted scope rather than retaining mutable caller context`,async()=>{
  const context=scope();const api=createIdentityAdministrationApi({rpc:async()=>({data:receipt(kind),error:null})},context);
  context.tenant_id=id(99);context.environment='production';
  assert.deepEqual(await api[kind](request(kind)),receipt(kind));
 });
 test(`${kind} fails closed on malformed or mismatched receipts`,async()=>{
  for(const data of [null,[],{},42,{...receipt(kind),tenant_id:id(99)},{...receipt(kind),environment:'production'},
   {...receipt(kind),token:'sensitive'},{...receipt(kind),status:'active'},{...receipt(kind),idempotency_key:'other'}]){
   const api=createIdentityAdministrationApi({rpc:async()=>({data,error:null})},scope());
   await assert.rejects(api[kind](request(kind)));
  }
 });
 test(`${kind} sanitizes database errors even if a valid receipt accompanies the error`,async()=>{
  for(const [error,code] of [[{code:'42501',message:'sensitive'},'PERMISSION_DENIED'],
   [{code:'P0001',message:'IDEMPOTENCY_CONFLICT'},'IDEMPOTENCY_CONFLICT'],
   [{code:'P0001',message:'INVALID_STATE_TRANSITION'},'INVALID_STATE_TRANSITION'],
   [{code:'23505',message:'sensitive identity'},'INTERNAL_ERROR'],[{code:'P0001',message:'sensitive'},'INTERNAL_ERROR']]){
   let calls=0;const api=createIdentityAdministrationApi({rpc:async()=>{calls++;return {data:receipt(kind),error};}},scope());
   await assert.rejects(api[kind](request(kind)),e=>e.code===code&&e.message===code);assert.equal(calls,1);
  }
 });
 test(`${kind} never retries ambiguous failures or exposes transport diagnostics`,async()=>{
  let calls=0;const api=createIdentityAdministrationApi({rpc:async()=>{calls++;throw Error('secret transport diagnostic');}},scope());
  await assert.rejects(api[kind](request(kind)),e=>e.code==='INTERNAL_ERROR'&&e.message==='INTERNAL_ERROR');assert.equal(calls,1);
 });
}
test('invalid trusted scope is rejected at construction',()=>{
 for(const value of [{tenant_id:id(1)},{tenant_id:'invalid',environment:'sandbox'},{tenant_id:id(1),environment:'unknown'}])
  assert.throws(()=>createIdentityAdministrationApi({rpc:async()=>null},value));
});
