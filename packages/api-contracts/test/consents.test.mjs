import assert from 'node:assert/strict';
import test from 'node:test';
import {tenantId} from '../../domain/src/index.ts';
import {parseGrantConsentPayload,parseRevokeConsentPayload,parseConsentCheckPayload,parseGrantConsentRequest,parseRevokeConsentRequest,parseConsentReceipt,createFlexexaConsentApi} from '../src/consents.ts';
import {cases,grant,revoke,check} from './fixtures/consents.mjs';
const tenant=tenantId('ce200000-0000-4000-8000-000000000001'),other=tenantId('ce200000-0000-4000-8000-000000000002');
const raw={tenant_id:tenant,idempotency_key:'consent:1',correlation_id:other,payload:grant};
for(const c of cases)test(`consent contract: ${c.name}`,()=>{
 const parse={grant:parseGrantConsentPayload,revoke:parseRevokeConsentPayload,check:parseConsentCheckPayload}[c.kind];
 if(c.error)assert.throws(()=>parse(c.input),{code:c.error});
 else {assert.deepEqual(parse(c.input),c.expected);assert(Object.isFrozen(parse(c.input)));}
});
test('consent mutations bind tenant, idempotency and original replay receipt',()=>{
 for(const [parse,payload,status] of [[parseGrantConsentRequest,grant,'granted'],[parseRevokeConsentRequest,revoke,'revoked']]){
  const request=parse({...raw,payload},tenant);
  const receipt={tenant_id:tenant,resource_type:'consent',resource_id:revoke.consent_id,correlation_id:tenant,idempotency_key:raw.idempotency_key,environment:'sandbox',status};
  assert.deepEqual(parseConsentReceipt(receipt,request),receipt);
  assert.throws(()=>parse({...raw,payload,tenant_id:other},tenant),{code:'TENANT_MISMATCH'});
  for(const change of [{status:'connected'},{environment:'production'},{idempotency_key:'different'},{resource_type:'asset'},{evidence_json:{}}])assert.throws(()=>parseConsentReceipt({...receipt,...change},request),{code:'VALIDATION_ERROR'});
 }
});
test('typed consent API rejects spoofing before I/O and checks the full pinned scope',async()=>{
 let calls=0;
 const api=createFlexexaConsentApi({rpc:async(name,args)=>{
  calls++;assert.equal(name,'flexexa_check_consent');assert.equal(args.p_tenant_id,tenant);assert.deepEqual(args.p_payload,check);
  return {error:null,data:{tenant_id:tenant,consent_id:check.consent_id,environment:'sandbox',consent_type:'remote_control',policy_version:check.policy_version,valid:false,reason_code:'CONSENT_REQUIRED',checked_at:'2026-10-03T20:00:00.000Z'}};
 }},tenant);
 await assert.rejects(api.checkConsent({...check,tenant_id:other}),{code:'VALIDATION_ERROR'});assert.equal(calls,0);
 assert.equal((await api.checkConsent(check)).valid,false);assert.equal(calls,1);
});
test('typed mutations use named RPCs and historical receipts',async()=>{
 const api=createFlexexaConsentApi({rpc:async(name,args)=>{
  assert.equal(args.p_tenant_id,tenant);
  return {error:null,data:{tenant_id:tenant,resource_type:'consent',resource_id:revoke.consent_id,environment:'sandbox',correlation_id:tenant,idempotency_key:raw.idempotency_key,status:name==='flexexa_grant_consent'?'granted':'revoked'}};
 }},tenant);
 assert.equal((await api.grantConsent(raw)).status,'granted');
 assert.equal((await api.revokeConsent({...raw,payload:revoke})).status,'revoked');
});
test('consent check cannot turn malformed or mismatched responses into permission',async()=>{
 const base={tenant_id:tenant,consent_id:check.consent_id,environment:'sandbox',consent_type:'remote_control',policy_version:check.policy_version,valid:true,reason_code:'valid',checked_at:'2026-10-03T20:00:00.000Z'};
 for(const change of [{valid:'true'},{reason_code:'CONSENT_REQUIRED'},{consent_id:other},{environment:'production'},{policy_version:'different'},{consent_type:'data_sharing'},{checked_at:'infinity'},{secret:'hidden'}]){
  const api=createFlexexaConsentApi({rpc:async()=>({error:null,data:{...base,...change}})},tenant);
  await assert.rejects(api.checkConsent(check),{code:'VALIDATION_ERROR'});
 }
 for(const result of [{error:{code:'42501',message:'private'},data:null},{error:{code:'P0001',message:'private evidence'},data:null}]){
  const api=createFlexexaConsentApi({rpc:async()=>result},tenant);
  await assert.rejects(api.checkConsent(check),{code:result.error.code==='42501'?'PERMISSION_DENIED':'INTERNAL_ERROR'});
 }
});
