import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createConnection} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {createIdentityServer} from '../src/server.ts';

const credential='TEST_ONLY_CREDENTIAL_DO_NOT_LOG';
async function fixture(run){
 const logs=[];let upstreamCalls=0;
 const server=createIdentityServer({url:'https://example.supabase.co',publishableKey:credential,adminKey:credential,
  environment:'sandbox',logSink:entry=>logs.push(entry),fetcher:async()=>{upstreamCalls++;throw Error('UNEXPECTED_UPSTREAM');}});
 const sockets=[];
 server.listen(0,'127.0.0.1');await once(server,'listening');
 const port=server.address().port,origin='http://127.0.0.1:'+port;
 async function connect(){
  const socket=createConnection({host:'127.0.0.1',port});sockets.push(socket);
  let received='';socket.on('data',chunk=>{received+=chunk.toString('utf8');});socket.on('error',()=>{});
  const closed=once(socket,'close');await once(socket,'connect');
  return {socket,closed,get received(){return received;}};
 }
 try{await run({origin,server,logs,connect,get upstreamCalls(){return upstreamCalls;}});}
 finally{for(const socket of sockets)socket.destroy();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
}
function bounded(promise,ms){
 let timer;
 return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('INCOMPLETE_REQUEST_NOT_TIMED_OUT')),ms);})])
  .finally(()=>clearTimeout(timer));
}
const post=origin=>fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',
 headers:{'content-type':'application/json',authorization:'Bearer '+credential},body:'{}'});

test('incomplete headers and dribbling bodies expire within the receive budget and release all admission slots',
 {timeout:18000},async()=>fixture(async f=>{
  const header=await f.connect();
  header.socket.write('POST /v1/identity/provisioning/execute HTTP/1.1\r\nHost: localhost\r\nX-Partial: ');
  const uploads=[];
  for(let i=0;i<8;i++){
   const upload=await f.connect(),admitted=once(f.server,'request');uploads.push(upload);
   upload.socket.write('POST /v1/identity/provisioning/execute HTTP/1.1\r\nHost: localhost\r\n'+
    'Content-Type: application/json\r\nAuthorization: Bearer '+credential+'\r\nContent-Length: 4000\r\n\r\n{');
   await admitted;
  }
  const saturated=await post(f.origin);assert.equal(saturated.status,503);assert.deepEqual(await saturated.json(),{error:'UNAVAILABLE'});
  const health=await fetch(f.origin+'/health/live');assert.equal(health.status,200);await health.text();
  // Continuous bytes must not refresh an absolute receive deadline.
  const drip=setInterval(()=>{if(!header.socket.destroyed)header.socket.write('x');
   for(const upload of uploads)if(!upload.socket.destroyed)upload.socket.write(' ');},100);
  try{await bounded(Promise.all([header,...uploads].map(c=>c.closed)),13500);}
  finally{clearInterval(drip);}
  for(const client of [header,...uploads])assert.match(client.received,/^HTTP\/1\.1 408 /u);
  assert.equal(f.logs.filter(e=>e.outcome==='aborted').length,8);
  const recovered=await post(f.origin);assert.equal(recovered.status,400);assert.deepEqual(await recovered.json(),{error:'VALIDATION_ERROR'});
  assert.equal(f.upstreamCalls,0);assert(!JSON.stringify(f.logs).includes(credential));
 }));
