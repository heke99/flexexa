import test from 'node:test';
import assert from 'node:assert/strict';
import { identityAdministrationRpc, parseIdentityAdministrationReceipt } from '../src/identity-administration.ts';
const id=n=>`be140000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),environment:'sandbox'};
const request=(kind='enroll')=>({tenant_id:id(1),idempotency_key:'identity-1',correlation_id:id(2),
 payload:kind==='enroll'?{api_client_id:id(3),auth_user_id:id(4),environment:'sandbox'}:
 {principal_id:id(5),environment:'sandbox',reason_code:'rotation'}});
const makeReceipt=(kind='enroll')=>({tenant_id:id(1),resource_type:'machine_principal',resource_id:id(5),correlation_id:id(6),
 idempotency_key:'identity-1',environment:'sandbox',status:kind==='enroll'?'enrolled':'revoked'});
for(const kind of ['enroll','revoke']) {
 test(`${kind} exact canonical RPC and historical receipt`,()=>{
  const call=identityAdministrationRpc(kind,request(kind),scope);
  assert.equal(call.function_name,`flexexa_${kind}_api_client_identity`);
  assert.deepEqual(Object.keys(call.args).sort(),['p_correlation_id','p_idempotency_key','p_payload','p_tenant_id']);
  assert.equal(call.args.p_tenant_id,id(1));
  assert.equal(parseIdentityAdministrationReceipt(makeReceipt(kind),call).correlation_id,id(6));
  assert(Object.isFrozen(call.args));
 });
 for(const [name,mutate] of [
  ['other tenant',v=>({...v,tenant_id:id(99)})],
  ['bad correlation',v=>({...v,correlation_id:'x'})],
  ['missing environment',v=>({...v,payload:{...v.payload,environment:undefined}})],
  ['production mismatch',v=>({...v,payload:{...v.payload,environment:'production'}})],
  ['caller secret',v=>({...v,payload:{...v.payload,secret:'do-not-accept'}})],
  ['caller authority',v=>({...v,payload:{...v.payload,approved:true}})],
  ['extra envelope',v=>({...v,actor_id:id(99)})],
  ['newline key',v=>({...v,idempotency_key:'bad\n'})],
 ]) test(`${kind} rejects ${name}`,()=>assert.throws(()=>identityAdministrationRpc(kind,mutate(request(kind)),scope)));
 for(const [key,value] of [['tenant_id',id(99)],['resource_type','api_client'],['environment','production'],['status','active'],
   ['idempotency_key','other'],['correlation_id','invalid'],['secret','not-allowed']])
  test(`${kind} receipt rejects ${key}`,()=>assert.throws(()=>parseIdentityAdministrationReceipt({...makeReceipt(kind),[key]:value},identityAdministrationRpc(kind,request(kind),scope))));
}
test('revocation receipt must reference requested principal',()=>assert.throws(()=>parseIdentityAdministrationReceipt({...makeReceipt('revoke'),resource_id:id(99)},identityAdministrationRpc('revoke',request('revoke'),scope))));
test('unexpected operation is not generic SQL',()=>assert.throws(()=>identityAdministrationRpc('grant_all',request(),scope)));
test('enrollment accepts canonicalized upper-case UUID',()=>assert.equal(identityAdministrationRpc('enroll',{...request(),payload:{...request().payload,api_client_id:id(3).toUpperCase()}},scope).args.p_payload.api_client_id,id(3)));
test('scope itself must contain environment',()=>assert.throws(()=>identityAdministrationRpc('enroll',request(),{tenant_id:id(1)})));
