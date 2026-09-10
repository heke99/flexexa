import test from 'node:test';
import assert from 'node:assert/strict';
import {createProvisioner} from '../src/provision.ts';
import {DomainError} from '@flexexa/domain';
const id=n=>'ce300000-0000-4000-8000-'+String(n).padStart(12,'0');
const scope={tenant_id:id(1),environment:'sandbox'};
const lease={...scope,resource_type:'identity_execution_lease',resource_id:id(2),request_id:id(3),generation:1,api_client_id:id(4),
 intended_auth_user_id:id(5),expires_at:'2099-01-01T00:00:00.000000Z',correlation_id:id(6),idempotency_key:'lease',status:'leased'};
const check={...scope,lease_id:id(2),request_id:id(3),generation:1,api_client_id:id(4),intended_auth_user_id:id(5),expires_at:lease.expires_at};
const complete={...scope,resource_type:'identity_provisioning_completion',resource_id:id(7),request_id:id(3),lease_id:id(2),principal_id:id(8),generation:1,
 correlation_id:id(6),idempotency_key:'finish',status:'completed'};
const input=()=>({lease:{...lease},idempotency_key:'finish',correlation_id:id(6)});
function fixture({historical=false,found=false,createFails=false,reconciled=true,checkFailsAt=0,lookupFails=false}={}){
 const calls=[];let finalizations=0,checks=0,lookups=0;
 const rpc={async rpc(name){
  calls.push(name);if(name==='flexexa_finalize_identity_provisioning'){
   if(historical||finalizations++>0)return {data:complete,error:null};return {data:null,error:{code:'42501',message:'private detail'}};
  }
  if(++checks===checkFailsAt)return {data:null,error:{code:'42501'}};
  return {data:check,error:null};
 }};
 const admin={async find(identity){calls.push('find');assert.deepEqual(identity,check);if(lookupFails)throw new DomainError('PERMISSION_DENIED');return lookups++===0?found:reconciled;},
  async create(identity){calls.push('create');assert.deepEqual(identity,check);if(createFails)throw Error('SENSITIVE_TIMEOUT');}};
 return {api:createProvisioner(rpc,admin,scope),calls};
}
test('historical finalization makes no privileged Auth call',async()=>{
 const f=fixture({historical:true});assert.deepEqual(await f.api.execute(input()),complete);assert.deepEqual(f.calls,['flexexa_finalize_identity_provisioning']);
});
test('historical receipt must match the supplied request and generation',async()=>{
 const f=fixture({historical:true}),p=input();p.lease.generation=2;
 await assert.rejects(()=>f.api.execute(p),e=>e.code==='VALIDATION_ERROR');assert.deepEqual(f.calls,['flexexa_finalize_identity_provisioning']);
});
test('new subject is checked before read, rechecked before creation and finalized by SQL',async()=>{
 const f=fixture();assert.deepEqual(await f.api.execute(input()),complete);
 assert.deepEqual(f.calls,['flexexa_finalize_identity_provisioning','flexexa_check_identity_execution_lease','find','flexexa_check_identity_execution_lease','create','flexexa_finalize_identity_provisioning']);
});
test('existing attested reserved subject is reconciled without create',async()=>{
 const f=fixture({found:true});await f.api.execute(input());assert(!f.calls.includes('create'));
});
test('ambiguous create reconciles exactly once and never repeats POST',async()=>{
 const f=fixture({createFails:true});await f.api.execute(input());assert.equal(f.calls.filter(c=>c==='create').length,1);assert.equal(f.calls.filter(c=>c==='find').length,2);
});
test('unresolved ambiguous create fails without exposing upstream diagnostics',async()=>{
 const f=fixture({createFails:true,reconciled:false});await assert.rejects(()=>f.api.execute(input()),e=>e.code==='INTERNAL_ERROR'&&!String(e).includes('SENSITIVE'));
 assert.equal(f.calls.filter(c=>c==='create').length,1);
});
for(const [at,privileged] of [[1,[]],[2,['find']],[3,['find','create']]])test(`authority loss at check ${at} stops subsequent privileged calls`,async()=>{
 const f=fixture({checkFailsAt:at,createFails:at===3});await assert.rejects(()=>f.api.execute(input()),e=>e.code==='PERMISSION_DENIED');
 assert.deepEqual(f.calls.filter(c=>c==='find'||c==='create'),privileged);
});
test('foreign attestation is never overwritten',async()=>{
 const f=fixture({lookupFails:true});await assert.rejects(()=>f.api.execute(input()),e=>e.code==='PERMISSION_DENIED');assert(!f.calls.includes('create'));
});
test('caller cannot replace reserved identity in receipt',async()=>{
 const f=fixture(),p=input();p.lease.intended_auth_user_id=id(99);await assert.rejects(()=>f.api.execute(p),e=>e.code==='VALIDATION_ERROR');assert(!f.calls.includes('find'));
});
test('unexpected body fields are rejected before RPC',async()=>{
 const f=fixture();await assert.rejects(()=>f.api.execute({...input(),admin_key:'forbidden'}));assert.deepEqual(f.calls,[]);
});
test('ambiguous finalization does not fall through into Auth administration',async()=>{
 let used=false;const api=createProvisioner({rpc:async()=>{throw Error('network');}},{find:async()=>{used=true;return false;},create:async()=>{used=true;}},scope);
 await assert.rejects(()=>api.execute(input()),e=>e.code==='INTERNAL_ERROR');assert.equal(used,false);
});
