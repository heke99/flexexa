import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { normalizeEnodeSoc } from '../src/normalize-soc.ts';
import { verifyEnodeDelivery } from '../src/webhook-integrity.ts';
const id=n=>`a0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={tenant_id:id(1),asset_id:id(2)};
const binding={...scope,connection_id:id(3),provider_id:id(4),provider_account_id:id(5),provider_key:'enode',external_asset_id:'vehicle-7'};
const now='2026-09-09T12:00:00Z';
const vehicle={id:'vehicle-7',userId:'opaque-enode-user',isReachable:true,lastSeen:now,chargeState:{batteryLevel:38,lastUpdated:'2026-09-09T11:00:00Z'}};
const normalize=(value=vehicle,b=binding,s=scope)=>normalizeEnodeSoc(value,b,s,'opaque-enode-user',now);
const secret='fixture-only-secret-not-for-deployment';
const bytes=s=>new TextEncoder().encode(s);
const sign=(body,key=secret)=>'sha1='+createHmac('sha1',key).update(body).digest('hex');
const verify=(body,signature=sign(body),key=secret,subscription=id(40))=>verifyEnodeDelivery(body,signature,key,subscription,1048576);
test('Enode data retains old observation time despite a recent cloud response',()=>{
 const result=normalize();assert.equal(result.soc_percent,38);assert.equal(result.state_observed_at,'2026-09-09T11:00:00.000Z');assert.equal(result.received_at,'2026-09-09T12:00:00.000Z');
 assert.equal(result.provider_cloud_reachable,true);assert(!Object.hasOwn(result,'online'));assert(!Object.hasOwn(result,'chargeState'));
});
test('absent telemetry remains unknown rather than fabricated zero, unplugged or stopped',()=>{
 const result=normalize({...vehicle,chargeState:null});assert.equal(result.soc_percent,null);assert.equal(result.state_observed_at,null);assert.equal(result.quality,'unknown');
 const zero=normalize({...vehicle,chargeState:{batteryLevel:0}});assert.equal(zero.soc_percent,0);assert.equal(zero.quality,'unknown');
});
test('Enode account, asset and tenant mapping is enforced before normalization',()=>{
 for(const patch of [{id:'another-vehicle'},{userId:'another-user'}])assert.throws(()=>normalize({...vehicle,...patch}),{code:'PERMISSION_DENIED'});
 assert.throws(()=>normalize(vehicle,{...binding,tenant_id:id(8)}),{code:'TENANT_MISMATCH'});
 assert.throws(()=>normalize(vehicle,{...binding,provider_key:'ocpp'}));
});
test('malformed percent, future state and fake boolean fields are rejected',()=>{
 for(const value of [-1,101,Infinity,NaN,'38',{}])assert.throws(()=>normalize({...vehicle,chargeState:{batteryLevel:value}}));
 assert.throws(()=>normalize({...vehicle,isReachable:'true'}));
 assert.throws(()=>normalize({...vehicle,chargeState:{batteryLevel:1,lastUpdated:'2026-09-10T00:00:00Z'}}));
});
test('documented Enode HMAC vector is verified against untouched raw bytes',async()=>{
 const result=await verify(bytes('{"payload":"example"}'),'sha1=e417e6fc2e7f8a78c93a35a7b344d36ce179fc8d','example-secret');assert.equal(result.payload_utf8,'{"payload":"example"}');assert.match(result.payload_sha256,/^[a-f0-9]{64}$/);
});
test('tampered payloads, wrong secrets and malformed signatures are rejected',async()=>{
 const payload=bytes('[{"event":"fixture"}]');
 for(const signature of ['',null,'sha1=','sha256='+ 'a'.repeat(64),sign(payload)+' '])await assert.rejects(()=>verify(payload,signature),{code:'PERMISSION_DENIED'});
 await assert.rejects(()=>verify(payload,sign(payload),'wrong-secret'),{code:'PERMISSION_DENIED'});
 await assert.rejects(()=>verify(bytes('[{"event":"changed"}]'),sign(payload)),{code:'PERMISSION_DENIED'});
});
test('payload reformatting is not allowed before HMAC validation',async()=>{
 const original=bytes('[ {"x": 1} ]');await assert.rejects(()=>verify(bytes('[{"x":1}]'),sign(original)));
});
test('deduplication is based on trusted subscription plus body hash, not an unsigned delivery header',async()=>{
 const payload=bytes('[]');const a=await verify(payload),b=await verify(payload),c=await verify(payload,sign(payload),secret,id(41));
 assert.equal(a.deduplication_key,b.deduplication_key);assert.notEqual(a.deduplication_key,c.deduplication_key);
 assert(!Object.hasOwn(a,'tenant_id'));assert(!Object.hasOwn(a,'delivery_id'));
});
test('body bytes are snapshotted before await and are not mutable through output',async()=>{
 const body=bytes('[1]'),expected=sign(body);const pending=verify(body,expected);body[1]=50;
 assert.equal((await pending).payload_utf8,'[1]');
});
test('size and UTF-8 validation fail closed without exposing the secret',async()=>{
 const invalid=new Uint8Array([255]);await assert.rejects(()=>verify(invalid),{code:'VALIDATION_ERROR'});
 await assert.rejects(()=>verifyEnodeDelivery(bytes('[]'),sign(bytes('[]')),secret,id(40),1));
 await assert.rejects(()=>verify(new Uint8Array(0)));
});
