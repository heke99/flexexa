import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createServer} from 'node:http';
import * as identity from '../src/server.ts';

const credential='TEST_ONLY_CREDENTIAL_DO_NOT_LOG';
const id=n=>'ce600000-0000-4000-8000-'+String(n).padStart(12,'0');
const lease={tenant_id:id(1),environment:'sandbox',resource_type:'identity_execution_lease',resource_id:id(2),request_id:id(3),generation:1,
 api_client_id:id(4),intended_auth_user_id:id(5),expires_at:'2099-01-01T00:00:00.000000Z',correlation_id:id(6),idempotency_key:'lease',status:'leased'};
const completion={tenant_id:id(1),environment:'sandbox',resource_type:'identity_provisioning_completion',resource_id:id(7),
 request_id:id(3),lease_id:id(2),principal_id:id(8),generation:1,correlation_id:id(6),idempotency_key:'finish',status:'completed'};
const input={lease,idempotency_key:'finish',correlation_id:id(6)};
async function fixture(run,fetcher=async()=>{throw Error('UNEXPECTED_UPSTREAM');}){
 const logs=[];
 const server=identity.createIdentityServer({url:'https://example.supabase.co',publishableKey:credential,adminKey:credential,
  environment:'sandbox',fetcher,logSink:entry=>logs.push(entry)});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{await run('http://127.0.0.1:'+server.address().port,server,logs);}
 finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
const post=origin=>fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',
 headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:JSON.stringify(input)});

test('readiness becomes unavailable during drain; liveness stays alive and rejected requests make no upstream call',async()=>{
 let calls=0;
 await fixture(async(origin,server,logs)=>{
  const ready=await fetch(origin+'/health/ready');assert.equal(ready.status,200);assert.deepEqual(await ready.json(),{status:'ready'});
  identity.beginIdentityDrain(server);identity.beginIdentityDrain(server);
  const draining=await fetch(origin+'/health/ready');assert.equal(draining.status,503);assert.deepEqual(await draining.json(),{status:'draining'});
  assert.equal(draining.headers.get('cache-control'),'no-store');
  const live=await fetch(origin+'/health/live');assert.equal(live.status,200);assert.deepEqual(await live.json(),{status:'alive'});
  const denied=await post(origin);assert.equal(denied.status,503);assert.deepEqual(await denied.json(),{error:'UNAVAILABLE'});assert.equal(calls,0);
  assert.deepEqual(logs.map(e=>e.route),['/health/ready','/health/ready','/health/live','/v1/identity/provisioning/execute']);
  assert(!JSON.stringify(logs).includes(credential));
 },async()=>{calls++;throw Error('UNEXPECTED_UPSTREAM');});
});

test('drain preserves an admitted canonical completion and denies a second request before any RPC',async()=>{
 const entered=Promise.withResolvers(),release=Promise.withResolvers();let calls=0;
 await fixture(async(origin,server)=>{
  const first=post(origin);first.catch(()=>{});
  try{
   await entered.promise;identity.beginIdentityDrain(server);
   const second=await post(origin);assert.equal(second.status,503);assert.deepEqual(await second.json(),{error:'UNAVAILABLE'});
   assert.equal(calls,1);release.resolve();
   const response=await first;assert.equal(response.status,200);assert.deepEqual(await response.json(),completion);assert.equal(calls,1);
  }finally{release.resolve();}
 },async(url)=>{
  calls++;assert(url.endsWith('/rest/v1/rpc/flexexa_finalize_identity_provisioning'));entered.resolve();await release.promise;
  return new Response(JSON.stringify(completion),{headers:{'content-type':'application/json'}});
 });
});

test('drain state is scoped to its managed server and cannot affect an unrelated server',async()=>{
 await fixture(async(firstOrigin,first)=>fixture(async(secondOrigin,second)=>{
  identity.beginIdentityDrain(first);
  const a=await fetch(firstOrigin+'/health/ready'),b=await fetch(secondOrigin+'/health/ready');
  assert.equal(a.status,503);await a.text();assert.equal(b.status,200);await b.text();
  assert.throws(()=>identity.beginIdentityDrain(createServer()),/IDENTITY_SERVER_UNKNOWN/);
  identity.beginIdentityDrain(second);
 }));
});
