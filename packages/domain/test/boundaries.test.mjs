import test from 'node:test';
import assert from 'node:assert/strict';
import { entityId, decimalString, text } from '../src/index.ts';
test('UUID and decimal parsers reject final-newline regex loopholes',()=>{
 assert.throws(()=>entityId('e5000000-0000-4000-8000-000000000001\n'),e=>e.code==='VALIDATION_ERROR');
 for(const v of ['1\n','1\r','1\r\n','1\u2028','1\u2029']) assert.throws(()=>decimalString(v),e=>e.code==='VALIDATION_ERROR');
});
test('text bounds count Unicode scalars and reject malformed surrogate input',()=>{
 assert.equal(text('🚗'.repeat(200)),'🚗'.repeat(200));
 assert.throws(()=>text('🚗'.repeat(201)),e=>e.code==='VALIDATION_ERROR');
 assert.throws(()=>text('\ud800'),e=>e.code==='VALIDATION_ERROR');
 assert.throws(()=>text('\udfff'),e=>e.code==='VALIDATION_ERROR');
});
