import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createIdentityServer} from '../src/server.ts';

const id=n=>'ce500000-0000-4000-8000-'+String(n).padStart(12,'0');
const uuid=/^[0-9a-f-]{36}$/;
const secret='TEST_ONLY_CREDENTIAL_DO_NOT_LOG';
async function fixture(run, options={}){
 const logs=[],calls=[];
 const server=createIdentityServer({url:'https://example.supabase.co',publishableKey:secret,adminKey:secret,environment:'sandbox',
  logSink:entry=>logs.push(entry),fetcher:async(url,init)=>{calls.push({url,...init});throw Error(secret+' private@example.invalid');},...options});
 server.listen(0,'127.0.0.1');await once(server,'listening');
 try{await run('http://127.0.0.1:'+server.address().port,logs,calls);}
 finally{await new Promise(resolve=>server.close(resolve));}
}
test('real HTTP logs use fixed routes and omit headers, raw URL, bodies and PII',async()=>fixture(async(origin,logs)=>{
 const response=await fetch(origin+'/private@example.invalid?token='+secret,{headers:{Authorization:'Bearer '+secret,'x-correlation-id':'private@example.invalid'}});
 assert.equal(response.status,404);await response.text();
 assert.equal(logs.length,1);const entry=logs[0];
 assert.equal(entry.route,'unmatched');assert.equal(entry.method,'GET');assert.equal(entry.status_code,404);
 assert.equal(entry.outcome,'completed');assert(uuid.test(entry.request_id));assert.equal(entry.correlation_id,entry.request_id);
 assert.equal(response.headers.get('x-request-id'),entry.request_id);assert.equal(response.headers.get('x-correlation-id'),entry.correlation_id);
 assert(entry.duration_ms>=0);assert(!JSON.stringify(logs).includes(secret));assert(!JSON.stringify(logs).includes('private@'));
 assert.deepEqual(Object.keys(entry).sort(),['correlation_id','duration_ms','event','method','outcome','request_id','route','service','status_code']);
}));
test('valid incoming correlation is retained but each request receives a distinct server ID',async()=>fixture(async(origin,logs)=>{
 await Promise.all([1,2].map(async()=>{const response=await fetch(origin+'/health/live',{headers:{'x-correlation-id':id(6)}});await response.text();}));
 assert.equal(logs.length,2);assert(logs.every(e=>e.correlation_id===id(6)&&e.status_code===200));assert.notEqual(logs[0].request_id,logs[1].request_id);
}));
test('unauthorized request is logged once without sending any privileged request',async()=>fixture(async(origin,logs,calls)=>{
 const response=await fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:secret})});
 assert.equal(response.status,403);await response.text();assert.equal(logs.length,1);assert.equal(calls.length,0);assert.equal(logs[0].status_code,403);
 assert(!JSON.stringify(logs).includes(secret));
}));
function input(correlation){return {lease:{tenant_id:id(1),environment:'sandbox',resource_type:'identity_execution_lease',resource_id:id(2),request_id:id(3),generation:1,
 api_client_id:id(4),intended_auth_user_id:id(5),expires_at:'2099-01-01T00:00:00.000000Z',correlation_id:correlation,idempotency_key:'lease',status:'leased'},
 idempotency_key:'finish',correlation_id:correlation};}
test('concurrent request correlations propagate to caller RPC independently; upstream diagnostics stay private',async()=>fixture(async(origin,logs,calls)=>{
 await Promise.all([id(6),id(7)].map(async correlation=>{
  const response=await fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify(input(correlation))});
  assert.equal(response.status,502);assert.equal(response.headers.get('x-correlation-id'),correlation);assert.deepEqual(await response.json(),{error:'INTERNAL_ERROR'});
 }));
 assert.equal(calls.length,2);assert.deepEqual(calls.map(c=>c.headers['X-Correlation-Id']).sort(),[id(6),id(7)]);
 assert.deepEqual(logs.map(e=>e.correlation_id).sort(),[id(6),id(7)]);assert(logs.every(e=>e.status_code===502));
 assert(!JSON.stringify(logs).includes(secret));assert(!JSON.stringify(logs).includes('private@'));
}));
test('diagnostic sink failure cannot change an HTTP result',async()=>fixture(async origin=>{
 const response=await fetch(origin+'/health/live');assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'alive'});
},{logSink(){throw Error('collector down');}}));
