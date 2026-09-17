import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyEnodeDelivery} from '../src/webhook-integrity.ts';
test('signature is an exact 45-byte token, not a regex match before a final line terminator',async()=>{
 const payload=new TextEncoder().encode('[]'),secret='fixture-only';
 const signature='sha1='+createHmac('sha1',secret).update(payload).digest('hex');
 const verify=value=>verifyEnodeDelivery(payload,value,secret,'a0000000-0000-4000-8000-000000000040',1024);
 for(const suffix of ['\n','\r','\r\n','\u2028','\u2029','\t',' ']) {
  await assert.rejects(()=>verify(signature+suffix),{code:'PERMISSION_DENIED'},JSON.stringify(suffix));
 }
 assert.equal((await verify(signature)).payload_utf8,'[]');
});
