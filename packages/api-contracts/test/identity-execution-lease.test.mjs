import test from 'node:test';
import assert from 'node:assert/strict';
import {identityExecutionLeaseRpc,identityExecutionLeaseCheckRpc,parseIdentityExecutionLeaseReceipt,parseIdentityExecutionLeaseCheck,createIdentityExecutionLeaseApi} from '../src/identity-administration.ts';
const id=n=>`cf190000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),environment:'sandbox'};
const request=()=>({tenant_id:id(1),idempotency_key:'lease-1',correlation_id:id(2),payload:{request_id:id(3),environment:'sandbox'}});
const receipt=()=>({tenant_id:id(1),resource_type:'identity_execution_lease',resource_id:id(4),request_id:id(3),generation:1,
 api_client_id:id(5),intended_auth_user_id:id(6),environment:'sandbox',expires_at:'2000-02-29T12:30:59.123456+00:00',correlation_id:id(7),idempotency_key:'lease-1',status:'leased'});
const checked=()=>({tenant_id:id(1),lease_id:id(4),request_id:id(3),generation:1,api_client_id:id(5),intended_auth_user_id:id(6),environment:'sandbox',expires_at:receipt().expires_at});
const acquireCall=()=>identityExecutionLeaseRpc(request(),scope);
const checkCall=()=>identityExecutionLeaseCheckRpc(receipt(),scope);
test('typed lease transport copies scope, uses exact RPCs and preserves server correlation and microseconds',async()=>{
 const context={...scope},calls=[];
 const api=createIdentityExecutionLeaseApi({rpc:async(name,args)=>{
  calls.push({name,args});assert(Object.isFrozen(args));
  return {data:name==='flexexa_acquire_identity_execution_lease'?receipt():checked(),error:null};
 }},context);
 context.tenant_id=id(99);context.environment='production';
 const lease=await api.acquire(request());
 assert.deepEqual(lease,{...receipt(),expires_at:'2000-02-29T12:30:59.123456Z'});
 assert.equal(lease.correlation_id,id(7));assert(Object.isFrozen(lease));
 assert.deepEqual(await api.check(lease),{...checked(),expires_at:lease.expires_at});
 assert.deepEqual(calls,[{name:'flexexa_acquire_identity_execution_lease',args:{p_tenant_id:id(1),p_payload:request().payload,p_idempotency_key:'lease-1',p_correlation_id:id(2)}},
  {name:'flexexa_check_identity_execution_lease',args:{p_tenant_id:id(1),p_lease_id:id(4)}}]);
 assert(Object.isFrozen(calls[0].args.p_payload));assert(Object.isFrozen(api));assert.deepEqual(Object.keys(api),['acquire','check']);
});
for(const [name,change] of [
 ['foreign tenant',v=>({...v,tenant_id:id(99)})],['foreign environment',v=>({...v,payload:{...v.payload,environment:'production'}})],
 ['missing environment',v=>({...v,payload:{request_id:id(3)}})],['chosen generation',v=>({...v,payload:{...v.payload,generation:5}})],
 ['secret input',v=>({...v,payload:{...v.payload,secret:'hidden'}})],['chosen actor',v=>({...v,actor_id:id(99)})],
 ['bad request ID',v=>({...v,payload:{...v.payload,request_id:'bad'}})],['bad key',v=>({...v,idempotency_key:'bad\n'})],
])test(`acquisition rejects ${name} before I/O`,async()=>{
 let calls=0;const api=createIdentityExecutionLeaseApi({rpc:async()=>{calls++;throw Error();}},scope);
 await assert.rejects(api.acquire(change(request())));assert.equal(calls,0);
});
for(const [field,value] of [['tenant_id',id(99)],['request_id',id(99)],['resource_type','machine_principal'],['resource_id','bad'],['status','completed'],
 ['environment','production'],['api_client_id','bad'],['intended_auth_user_id','bad'],['correlation_id','bad'],['idempotency_key','different'],['secret','hidden']])
 test(`lease receipt rejects ${field}`,()=>assert.throws(()=>parseIdentityExecutionLeaseReceipt({...receipt(),[field]:value},acquireCall())));
for(const generation of [0,-1,1.5,'1',null,NaN,Infinity,2147483648])
 test(`generation is a bounded positive PostgreSQL integer: ${String(generation)}`,()=>assert.throws(()=>parseIdentityExecutionLeaseReceipt({...receipt(),generation},acquireCall())));
for(const expires_at of ['2001-02-29T12:30:59Z','2000-02-30T12:30:59Z','2000-02-29T24:00:00Z','0000-01-01T00:00:00Z',
 '2000-02-29T12:30:59.1234567Z','2000-02-29T12:30:59+01:00','infinity',null])
 test(`expiry rejects invalid/non-UTC timestamp ${String(expires_at)}`,()=>assert.throws(()=>parseIdentityExecutionLeaseReceipt({...receipt(),expires_at},acquireCall())));
test('expiry normalizes UTC notation without truncating PostgreSQL precision or using local time as authority',()=>{
 for(const [input,expected] of [['2000-02-29T12:30:59Z','2000-02-29T12:30:59.000000Z'],['2000-02-29T12:30:59.1+00:00','2000-02-29T12:30:59.100000Z'],['2000-02-29T12:30:59.000001Z','2000-02-29T12:30:59.000001Z']])
  assert.equal(parseIdentityExecutionLeaseReceipt({...receipt(),expires_at:input},acquireCall()).expires_at,expected);
});
for(const [field,value] of [['tenant_id',id(99)],['lease_id',id(99)],['request_id',id(99)],['generation',2],['api_client_id',id(99)],
 ['intended_auth_user_id',id(99)],['environment','production'],['expires_at','2000-02-29T12:30:59.123457Z'],['secret','hidden']])
 test(`fresh check refuses changed ${field}`,()=>assert.throws(()=>parseIdentityExecutionLeaseCheck({...checked(),[field]:value},checkCall())));
test('check rejects foreign or malformed prior receipts before I/O',async()=>{
 let calls=0;const api=createIdentityExecutionLeaseApi({rpc:async()=>{calls++;throw Error();}},scope);
 for(const value of [null,{...receipt(),tenant_id:id(99)},{...receipt(),environment:'production'},{...receipt(),generation:'1'},{...receipt(),secret:'hidden'}])
  await assert.rejects(api.check(value));
 assert.equal(calls,0);
});
test('check never caches authority and fails closed on committed expiry/revocation responses',async()=>{
 let calls=0;const api=createIdentityExecutionLeaseApi({rpc:async()=>({data:++calls===1?checked():null,error:calls===1?null:{code:'P0001',message:'INVALID_STATE_TRANSITION'}})},scope);
 await api.check(receipt());
 await assert.rejects(api.check(receipt()),{code:'INVALID_STATE_TRANSITION'});assert.equal(calls,2);
});
test('both methods sanitize transport/database failures without retry or compensation',async()=>{
 for(const method of ['acquire','check'])for(const code of ['PERMISSION_DENIED','INVALID_STATE_TRANSITION','IDEMPOTENCY_CONFLICT','INTERNAL_ERROR']){
  let calls=0;const api=createIdentityExecutionLeaseApi({rpc:async()=>{
   calls++;if(code==='INTERNAL_ERROR')throw Error('secret');
   return {data:null,error:{code:'P0001',message:code,details:'secret'}};
  }},scope);
  await assert.rejects(api[method](method==='acquire'?request():receipt()),e=>e.code===code&&e.message===code);assert.equal(calls,1);
 }
});
test('null/malformed responses and invalid trusted scope fail closed',async()=>{
 for(const data of [null,true,[],{}]){
  const api=createIdentityExecutionLeaseApi({rpc:async()=>({data,error:null})},scope);
  await assert.rejects(api.acquire(request()));await assert.rejects(api.check(receipt()));
 }
 assert.throws(()=>createIdentityExecutionLeaseApi({rpc:async()=>null},{tenant_id:id(1)}));
});
