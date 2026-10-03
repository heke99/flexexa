import test from 'node:test';
import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

const credential='TEST_ONLY_PROCESS_CREDENTIAL_DO_NOT_LOG';
const id=n=>'ce700000-0000-4000-8000-'+String(n).padStart(12,'0');
const lease={tenant_id:id(1),environment:'sandbox',resource_type:'identity_execution_lease',resource_id:id(2),request_id:id(3),generation:1,
 api_client_id:id(4),intended_auth_user_id:id(5),expires_at:'2099-01-01T00:00:00.000000Z',correlation_id:id(6),idempotency_key:'lease',status:'leased'};
const completion={tenant_id:id(1),environment:'sandbox',resource_type:'identity_provisioning_completion',resource_id:id(7),
 request_id:id(3),lease_id:id(2),principal_id:id(8),generation:1,correlation_id:id(6),idempotency_key:'finish',status:'completed'};

async function fixture(t){
 const reservation=createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
 const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
 // Test-only preload intercepts upstream I/O. The production entrypoint, HTTP,
 // admission, RPC response parser and OS signal handler are all unmodified.
 // Ignoring AbortSignal intentionally models a dependency that cannot finish.
 const preload=`globalThis.fetch=async(url)=>{
  if(url!=='https://process-fixture.invalid/rest/v1/rpc/flexexa_finalize_identity_provisioning')throw Error('UNEXPECTED_UPSTREAM');
  process.send({kind:'entered'});
  await new Promise(resolve=>process.once('message',message=>{if(message==='release'){process.disconnect();resolve();}}));
  return new Response(${JSON.stringify(JSON.stringify(completion))},{headers:{'content-type':'application/json'}});
 };`;
 const child=fork(fileURLToPath(new URL('../src/main.ts',import.meta.url)),[],{
  execArgv:['--experimental-strip-types','--import','data:text/javascript,'+encodeURIComponent(preload)],
  env:{PORT:String(port),FLEXEXA_ENVIRONMENT:'sandbox',SUPABASE_URL:'https://process-fixture.invalid',
   SUPABASE_PUBLISHABLE_KEY:credential,SUPABASE_AUTH_ADMIN_KEY:credential},stdio:['ignore','pipe','pipe','ipc']});
 let output='';child.stdout.on('data',data=>{output+=data;});child.stderr.on('data',data=>{output+=data;});
 const exited=once(child,'exit');
 const closed=once(child,'close');
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');await exited;await closed;
  assert(!output.includes(credential));assert(!output.includes(id(1)));});
 const origin='http://127.0.0.1:'+port;
 let ready=false;
 for(let i=0;i<100;i++){
  assert.equal(child.exitCode,null);
  try{const response=await fetch(origin+'/health/ready',{signal:AbortSignal.timeout(500)});
   assert.equal(response.status,200);assert.deepEqual(await response.json(),{status:'ready'});ready=true;break;
  }catch{await new Promise(resolve=>setTimeout(resolve,50));}
 }
 assert(ready,'production entrypoint must become ready');
 const entered=once(child,'message');
 const response=fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',signal:AbortSignal.timeout(25000),
  headers:{'content-type':'application/json',authorization:'Bearer '+credential},
  body:JSON.stringify({lease,idempotency_key:'finish',correlation_id:id(6)})});
 response.catch(()=>{});
 assert.deepEqual((await entered)[0],{kind:'entered'});
 return {child,exited,response,origin};
}

test('real SIGTERM preserves an admitted canonical response and exits successfully', {timeout:10000},async t=>{
 const {child,exited,response,origin}=await fixture(t);
 assert(child.kill('SIGTERM'));
 // Observe closed admission instead of assuming a scheduling delay handled SIGTERM.
 let closed=false;
 for(let i=0;i<100;i++){
  try{const health=await fetch(origin+'/health/ready',{signal:AbortSignal.timeout(250)});
   await health.text();if(health.status===503){closed=true;break;}
  }catch{closed=true;break;}
  await new Promise(resolve=>setTimeout(resolve,10));
 }
 assert(closed,'SIGTERM must withdraw admission while the admitted RPC is still pending');
 assert.equal(child.exitCode,null);child.send('release');
 const result=await response;assert.equal(result.status,200);assert.deepEqual(await result.json(),completion);
 assert.deepEqual(await exited,[0,null]);
});

test('real SIGTERM enforces the existing 15-second deadline for stuck admitted work', {timeout:25000},async t=>{
 const {child,exited,response}=await fixture(t);
 const start=performance.now();assert(child.kill('SIGTERM'));
 assert.deepEqual(await exited,[1,null]);
 const elapsed=performance.now()-start;
 assert(elapsed>=14000&&elapsed<22000,'shutdown must reach its real deadline without extending indefinitely');
 await assert.rejects(response);
});
