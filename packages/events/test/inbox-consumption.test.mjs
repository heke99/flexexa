import test from 'node:test';
import assert from 'node:assert/strict';
import { consumePolicyPublication } from '../src/inbox-consumption.ts';
const tenant='be360000-0000-4000-8000-000000000001',eventId='be360000-0000-4000-8000-000000000002',version='be360000-0000-4000-8000-000000000003';
const scope={tenant_id:tenant,environment:'sandbox'};
const event=()=>({event_id:eventId,tenant_id:tenant,organization_id:null,event_type:'policy.version.published',event_version:1,occurred_at:'2026-09-10T00:00:00.000Z',received_at:'2026-09-10T00:00:00.000Z',correlation_id:version,causation_id:null,source:'flexexa.policy',payload:{environment:'sandbox',policy_set_version_id:version,rules_checksum:'a'.repeat(64)}});
const result=status=>({event_id:eventId,tenant_id:tenant,environment:'sandbox',consumer_key:'policy_readiness.v1',status});
test('committed inbox precedes broker acknowledgement',async()=>{
 const order=[];
 assert.equal(await consumePolicyPublication(scope,event(),{consume:async(s,e)=>{assert.deepEqual(s,scope);assert.deepEqual(JSON.parse(JSON.stringify(e)),event());order.push('commit');return result('processed');}},{acknowledge:async()=>{order.push('ack');}}),'processed');
 assert.deepEqual(order,['commit','ack']);
});
test('superseded and historical sandbox events can be acknowledged after commit',async()=>{
 const e=event();e.event_type='flexexa.policy.published';let ack=0;
 assert.equal(await consumePolicyPublication(scope,e,{consume:async()=>result('superseded')},{acknowledge:async()=>{ack++;}}),'superseded');assert.equal(ack,1);
});
test('lost commit response leaves delivery unacknowledged for durable deduplication',async()=>{
 let ack=0;await assert.rejects(consumePolicyPublication(scope,event(),{consume:async()=>{throw Error('LOST_RESPONSE');}},{acknowledge:async()=>{ack++;}}),/LOST_RESPONSE/);assert.equal(ack,0);
});
test('ack failure never repeats the business transaction in the same call',async()=>{
 let commits=0,acks=0;await assert.rejects(consumePolicyPublication(scope,event(),{consume:async()=>{commits++;return result('processed');}},{acknowledge:async()=>{acks++;throw Error('ACK_LOST');}}),/ACK_LOST/);assert.equal(commits,1);assert.equal(acks,1);
});
test('malformed or mismatched database receipts never acknowledge',async()=>{
 for(const bad of [{...result('processed'),event_id:version},{...result('processed'),tenant_id:version},{...result('processed'),environment:'production'},{...result('processed'),consumer_key:'other'},result('ready')]){
  let ack=0;await assert.rejects(consumePolicyPublication(scope,event(),{consume:async()=>bad},{acknowledge:async()=>{ack++;}}),/VALIDATION_ERROR/);assert.equal(ack,0);
 }
});
test('wrong tenant, environment, type, version, provenance and payload stop before I/O',async()=>{
 for(const mutate of [e=>{e.tenant_id=version;},e=>{e.payload.environment='production';},e=>{e.event_type='asset.connected';},e=>{e.event_version=2;},e=>{e.source='untrusted';},e=>{e.payload.rules_checksum='forged';},e=>{e.payload.extra=true;}]){
  const e=event();mutate(e);let calls=0;
  await assert.rejects(consumePolicyPublication(scope,e,{consume:async()=>{calls++;return result('processed');}},{acknowledge:async()=>{calls++;}}));assert.equal(calls,0);
 }
});
