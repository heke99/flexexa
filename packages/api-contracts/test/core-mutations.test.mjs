import test from 'node:test';
import assert from 'node:assert/strict';
import { cases } from './fixtures/core-mutations.mjs';
import { parseCreateCustomerPayload, parseCreateSitePayload, parseCreateMeteringPointPayload, parseCreateAssetPayload,
  parseCreateSiteRequest, parseCreateMeteringPointRequest, parseCreateAssetRequest } from '../src/index.ts';
const parse = {customer: parseCreateCustomerPayload, site: parseCreateSitePayload, metering_point: parseCreateMeteringPointPayload, asset: parseCreateAssetPayload};
for(const c of cases) test(`SQL/TypeScript contract: ${c.name}`,()=>{
  if(c.error) assert.throws(()=>parse[c.kind](c.input),e=>e.code===c.error);
  else assert.deepEqual(parse[c.kind](c.input),c.expected);
});
test('all new mutation envelopes independently reject a different tenant',()=>{
 const tenant='c5000000-0000-4000-8000-000000000001';
 for(const fn of [parseCreateSiteRequest,parseCreateMeteringPointRequest,parseCreateAssetRequest]){
  assert.throws(()=>fn({tenant_id:'c5000000-0000-4000-8000-000000000002',payload:{},idempotency_key:'key',correlation_id:tenant},tenant),e=>e.code==='TENANT_MISMATCH');
 }
});
