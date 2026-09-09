import assert from 'node:assert/strict';
import test from 'node:test';
import {tenantId} from '../../domain/src/index.ts';
import {parseRegisterProviderAccountPayload,parseRevokeProviderAccountPayload,parseRegisterProviderAccountRequest,parseRevokeProviderAccountRequest,parseProviderAccountReceipt} from '../src/index.ts';
import {cases} from './fixtures/provider-accounts.mjs';
const tenant=tenantId('ac200000-0000-4000-8000-000000000001');
const other=tenantId('ac200000-0000-4000-8000-000000000002');
const correlation='ac200000-0000-4000-8000-000000000003';
const resource='ac200000-0000-4000-8000-000000000004';
for(const c of cases)test(`provider account contract: ${c.name}`,()=>{
  const parse=c.kind==='register'?parseRegisterProviderAccountPayload:parseRevokeProviderAccountPayload;
  if(c.error)assert.throws(()=>parse(c.input),{code:c.error});
  else {assert.deepEqual(parse(c.input),c.expected);assert(Object.isFrozen(parse(c.input)));}
});
for(const kind of ['register','revoke']){
 const parse=kind==='register'?parseRegisterProviderAccountRequest:parseRevokeProviderAccountRequest;
 const payload=kind==='register'?{customer_id:resource,provider_key:'ocpp',environment:'sandbox'}:{provider_account_id:resource,environment:'sandbox',reason_code:'security'};
 const raw={tenant_id:tenant,idempotency_key:'account:1',correlation_id:correlation,payload};
 const request=parse(raw,tenant);
 const receipt={tenant_id:tenant,resource_type:'provider_account',resource_id:resource,correlation_id:other,idempotency_key:raw.idempotency_key,environment:'sandbox',status:kind==='register'?'registered':'revoked'};
 test(`${kind} rejects spoofed tenant`,()=>assert.throws(()=>parse({...raw,tenant_id:other},tenant),{code:'TENANT_MISMATCH'}));
 test(`${kind} rejects invalid keys`,()=>{
  for(const key of ['', 'x\n','x '.repeat(80),null])assert.throws(()=>parse({...raw,idempotency_key:key},tenant),{code:'VALIDATION_ERROR'});
 });
 test(`${kind} preserves original retry correlation`,()=>{
  assert.notEqual(receipt.correlation_id,request.correlation_id);
  assert.deepEqual(parseProviderAccountReceipt(receipt,request),receipt);
  assert(Object.isFrozen(parseProviderAccountReceipt(receipt,request)));
 });
 test(`${kind} rejects mismatched receipt`,()=>{
  for(const change of [{environment:'production'},{idempotency_key:'other'},{resource_type:'asset'},{status:'connected'},{credential_reference:'vault://hidden'},{correlation_id:'invalid'}])
   assert.throws(()=>parseProviderAccountReceipt({...receipt,...change},request),{code:'VALIDATION_ERROR'});
  assert.throws(()=>parseProviderAccountReceipt({...receipt,tenant_id:other},request),{code:'TENANT_MISMATCH'});
  if(kind==='revoke')assert.throws(()=>parseProviderAccountReceipt({...receipt,resource_id:other},request),{code:'VALIDATION_ERROR'});
 });
}
