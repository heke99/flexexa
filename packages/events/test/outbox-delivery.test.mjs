import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverOutboxEvent } from '../src/outbox-delivery.ts';
const id=n=>`be340000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const now=Date.parse('2026-09-10T12:00:00Z');
const scope={tenant_id:id(1),environment:'sandbox'};
const claim=()=>({lease_id:id(2),generation:1,expires_at:new Date(now+30000).toISOString(),environment:'sandbox',event:{event_id:id(3),event_type:'flexexa.fixture.created',event_version:1,occurred_at:new Date(now).toISOString(),received_at:new Date(now).toISOString(),tenant_id:id(1),organization_id:id(4),correlation_id:id(5),causation_id:null,source:'flexexa.fixture',payload:{environment:'sandbox',resource_id:id(6)}}});
function fixture(raw=claim(),publish=async()=>{}) {
 const calls=[];
 return {calls,database:{claim:async s=>{calls.push(['claim',s]);return raw;},finish:async(s,l,o)=>{calls.push(['finish',s,l,o]);return{lease_id:l,status:o==='published'?'published':'pending'};}},publisher:{publishConfirmed:async m=>{calls.push(['publish',m]);await publish(m);}}};
}
test('confirmation precedes durable acknowledgement and canonical IDs survive',async()=>{
 const f=fixture();assert.equal(await deliverOutboxEvent(scope,f.database,f.publisher,()=>now),'published');
 assert.deepEqual(f.calls.map(c=>c[0]),['claim','publish','finish']);
 assert.equal(f.calls[2][3],'published');assert.equal(f.calls[1][1].message_id,id(3));
 assert.equal(JSON.parse(f.calls[1][1].body).tenant_id,id(1));assert.ok(Object.isFrozen(f.calls[1][1]));
});
test('empty queue performs no publication or acknowledgement',async()=>{
 const f=fixture(null);assert.equal(await deliverOutboxEvent(scope,f.database,f.publisher,()=>now),'idle');assert.equal(f.calls.length,1);
});
test('failed or unroutable publication records a bounded retry',async()=>{
 const f=fixture(claim(),async()=>{throw Error('BROKER_UNAVAILABLE');});
 assert.equal(await deliverOutboxEvent(scope,f.database,f.publisher,()=>now),'pending');assert.equal(f.calls[2][3],'retry');
});
test('lost acknowledgement response never causes a contradictory result or another publish',async()=>{
 const f=fixture();f.database.finish=async()=>{f.calls.push(['finish']);throw Error('RESPONSE_LOST');};
 await assert.rejects(deliverOutboxEvent(scope,f.database,f.publisher,()=>now),/RESPONSE_LOST/);
 assert.deepEqual(f.calls.map(c=>c[0]),['claim','publish','finish']);
});
test('tenant, environment, generation and lease time are checked before broker I/O',async()=>{
 for(const mutate of [c=>{c.event.tenant_id=id(99);},c=>{c.environment='production';},c=>{c.event.payload.environment='production';},c=>{delete c.event.payload.environment;},c=>{c.generation=11;},c=>{c.expires_at=new Date(now).toISOString();},c=>{c.expires_at=new Date(now+30001).toISOString();}]){
  const c=claim();mutate(c);const f=fixture(c);
  await assert.rejects(deliverOutboxEvent(scope,f.database,f.publisher,()=>now));assert.equal(f.calls.length,1);
 }
});
test('database cannot substitute another lease or an incompatible result',async()=>{
 for(const result of [{lease_id:id(99),status:'published'},{lease_id:id(2),status:'pending'}]){
  const f=fixture();f.database.finish=async()=>result;await assert.rejects(deliverOutboxEvent(scope,f.database,f.publisher,()=>now));
 }
});
