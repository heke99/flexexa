import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {startTelemetry} from '../src/telemetry.ts';
import {createIdentityServer} from '../src/server.ts';

for(const endpoint of ['http://example.com/v1/traces','https://user:password@example.com/v1/traces','https://example.com/v1/traces?token=secret','https://example.com/other']){
 test('invalid exporter endpoint rejected: '+endpoint,()=>assert.throws(()=>startTelemetry(endpoint,'sandbox'),/TELEMETRY_CONFIGURATION_INVALID/));
}
test('real SDK exports allowlisted OTLP over HTTP, preserving concurrent trace parentage without baggage or private payloads',async()=>{
 const batches=[],requests=[],logs=[];let rejectExport=false;
 const receiver=createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  assert.equal(req.url,'/v1/traces');assert.equal(req.headers['content-type'],'application/json');
  batches.push(JSON.parse(Buffer.concat(chunks).toString()));res.writeHead(rejectExport?503:200,{'Content-Type':'application/json'});res.end('{}');
 });
 receiver.listen(0,'127.0.0.1');await once(receiver,'listening');
 const telemetry=startTelemetry('http://127.0.0.1:'+receiver.address().port+'/v1/traces','sandbox',1);
 const secret='TEST_ONLY_PRIVATE_TOKEN';
 const server=createIdentityServer({url:'https://example.supabase.co',publishableKey:secret,adminKey:secret,environment:'sandbox',logSink:r=>logs.push(r),
  fetcher:async(url,init)=>{requests.push(init.headers);throw Error(secret+' private@example.invalid');}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 const id=n=>'ce600000-0000-4000-8000-'+String(n).padStart(12,'0');
 const input=correlation=>({lease:{tenant_id:id(1),environment:'sandbox',resource_type:'identity_execution_lease',resource_id:id(2),request_id:id(3),generation:1,
  api_client_id:id(4),intended_auth_user_id:id(5),expires_at:'2099-01-01T00:00:00.000000Z',correlation_id:correlation,idempotency_key:'lease',status:'leased'},idempotency_key:'finish',correlation_id:correlation});
 try{
  const parents=['11'.repeat(16),'22'.repeat(16)];
  await Promise.all(parents.map(async(parent,index)=>{
   const response=await fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+secret,
    traceparent:`00-${parent}-${'ab'.repeat(8)}-01`,baggage:'email=private@example.invalid',tracestate:'vendor=private'},body:JSON.stringify(input(id(6+index)))});
   assert.equal(response.status,502);await response.text();
  }));
  await telemetry.forceFlush();
  const spans=batches.flatMap(b=>b.resourceSpans.flatMap(r=>r.scopeSpans.flatMap(s=>s.spans)));
  assert.equal(spans.length,4);
  for(const traceId of parents){
   const pair=spans.filter(s=>s.traceId===traceId),serverSpan=pair.find(s=>s.kind===2),client=pair.find(s=>s.kind===3);
   assert.equal(pair.length,2);assert.equal(serverSpan.parentSpanId,'ab'.repeat(8));assert.equal(client.parentSpanId,serverSpan.spanId);
   assert.equal(serverSpan.status.code,2);assert.equal(client.status.code,2);
   assert.equal(serverSpan.name,'POST /v1/identity/provisioning/execute');assert.equal(client.name,'supabase.rpc');
   assert(logs.some(l=>l.trace_id===traceId&&l.span_id===serverSpan.spanId));
   assert(requests.some(h=>h.traceparent===`00-${traceId}-${client.spanId}-01`));
  }
  const encoded=JSON.stringify(batches);
  for(const denied of [secret,'private@example.invalid','example.supabase.co','idempotency_key','baggage','tracestate'])assert(!encoded.includes(denied),denied);
  for(const h of requests){assert(!('baggage' in h));assert(!('tracestate' in h));}
  assert(batches.every(b=>b.resourceSpans.every(r=>r.resource.attributes.some(a=>a.key==='service.name'&&a.value.stringValue==='flexexa-identity'))));
  rejectExport=true;
  const response=await fetch(origin+'/health/live');assert.equal(response.status,200);await response.text();
  await assert.rejects(()=>telemetry.forceFlush());
  const alive=await fetch(origin+'/health/live');assert.equal(alive.status,200);await alive.text();
 }finally{
  await new Promise(resolve=>server.close(resolve));await telemetry.shutdown();await new Promise(resolve=>receiver.close(resolve));
 }
});
