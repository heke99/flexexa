import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID,randomBytes,createHmac} from 'node:crypto';
import {once} from 'node:events';
import {createServer as httpServer} from 'node:http';
import {ensureSourceWorkspace} from './source-workspace.mjs';
let stage='isolated-environment';
async function main(){
 for(const [key,value] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'}))assert.equal(process.env[key],value);
 ensureSourceWorkspace();
 const {createIdentityServer}=await import('../../apps/identity-service/src/server.ts');
 const {createIdentityProvisioningRequestApi,createIdentityExecutionLeaseApi}=await import('../../packages/api-contracts/src/identity-administration.ts');
 // Disposable local keys stay in process memory; never log status output, JWTs or TOTP material.
 const local=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
 assert.equal(local.API_URL,'http://127.0.0.1:54321');assert.equal(typeof local.SERVICE_ROLE_KEY,'string');assert.equal(typeof local.ANON_KEY,'string');
 const q=v=>"'"+v.replaceAll("'","''")+"'";
 const sql=text=>execFileSync('psql',['-XAtq','--set=ON_ERROR_STOP=1','--command',text],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}).trim();
 async function request(path,token,payload,method='POST',admin=false){
  const r=await fetch(local.API_URL+path,{method,headers:{apikey:admin?local.SERVICE_ROLE_KEY:local.ANON_KEY,Authorization:'Bearer '+token,'Content-Type':'application/json'},
   ...(payload===undefined?{}:{body:JSON.stringify(payload)}),signal:AbortSignal.timeout(10000),redirect:'error'});
  const data=await r.json();if(!r.ok)throw Error('AUTH_HTTP_'+r.status);return data;
 }
 const [actor,org,tenant,otherTenant,member,client]=Array.from({length:6},()=>randomUUID());
 const email=actor+'@example.invalid',password=randomBytes(32).toString('base64url');
 stage='admin-user-create';await request('/auth/v1/admin/users',local.SERVICE_ROLE_KEY,{id:actor,email,password,email_confirm:true},'POST',true);
 sql(`insert into public.organizations(id,name,slug) values('${org}','Auth integration','${org}');
 insert into public.tenants(id,organization_id,name,slug) values('${tenant}','${org}','A','${tenant}'),('${otherTenant}','${org}','B','${otherTenant}');
 insert into public.memberships(id,tenant_id,user_id) values('${member}','${tenant}','${actor}');
 insert into public.membership_roles(tenant_id,membership_id,role_id) select '${tenant}','${member}',id from public.roles where tenant_id='${tenant}' and role_key='tenant_admin';
 insert into public.api_clients(id,tenant_id,client_id,name,expires_at) values('${client}','${tenant}','${client}','Auth integration',now()+interval '1 hour');`);
 stage='password-sign-in';const login=await request('/auth/v1/token?grant_type=password',local.ANON_KEY,{email,password});
 const aal1=login.access_token;assert.equal(typeof aal1,'string');
 stage='totp-enroll';const factor=await request('/auth/v1/factors',aal1,{factor_type:'totp',friendly_name:'isolated-verification'});
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',bits=[...factor.totp.secret.replaceAll('=','').toUpperCase()].map(c=>alphabet.indexOf(c).toString(2).padStart(5,'0')).join('');
 const secret=Buffer.from(bits.match(/.{8}/gu).map(b=>parseInt(b,2)));
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=createHmac('sha1',secret).update(counter).digest(),offset=digest.at(-1)&15;
 const code=String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
 stage='totp-challenge';const challenge=await request('/auth/v1/factors/'+factor.id+'/challenge',aal1,{});
 stage='totp-verify';const verified=await request('/auth/v1/factors/'+factor.id+'/verify',aal1,{challenge_id:challenge.id,code});
 const jwt=verified.access_token;assert.equal(typeof jwt,'string');
 const scope={tenant_id:tenant,environment:'sandbox'};
 const rpc={async rpc(name,args){try{return {data:await request('/rest/v1/rpc/'+name,jwt,args),error:null};}catch{return {data:null,error:{code:'UNKNOWN'}};}}};
 const intentApi=createIdentityProvisioningRequestApi(rpc,scope),leaseApi=createIdentityExecutionLeaseApi(rpc,scope);
 const newLease=async key=>{
  const intent=await intentApi.request({tenant_id:tenant,idempotency_key:'intent-'+key,correlation_id:randomUUID(),payload:{api_client_id:client,environment:'sandbox'}});
  return leaseApi.acquire({tenant_id:tenant,idempotency_key:'lease-'+key,correlation_id:randomUUID(),payload:{request_id:intent.resource_id,environment:'sandbox'}});
 };
 const observed={reads:0,creates:0};let loseCreateResponse=false;
 const transport=async(url,init)=>{
  if(new URL(url).pathname.startsWith('/auth/v1/admin/users')){
   if(init.method==='POST')observed.creates++;else observed.reads++;
  }
  const r=await fetch(url,init);
  if(loseCreateResponse&&new URL(url).pathname==='/auth/v1/admin/users'&&init.method==='POST'){
   loseCreateResponse=false;await r.arrayBuffer();throw Error('simulated lost response after real Auth commit');
  }
  return r;
 };
 const batches=[];
 const receiver=httpServer(async(req,res)=>{
  try{assert.equal(req.url,'/v1/traces');const chunks=[];for await(const chunk of req)chunks.push(chunk);
   batches.push(JSON.parse(Buffer.concat(chunks).toString()));res.setHeader('Content-Type','application/json');res.end('{}');
  }catch{res.statusCode=400;res.end();}
 });
 receiver.listen(0,'127.0.0.1');await once(receiver,'listening');
 const telemetryEndpoint='http://127.0.0.1:'+receiver.address().port+'/v1/traces';
 const correlations=[];
 const config={telemetryEndpoint,url:local.API_URL,allowLoopback:true,publishableKey:local.ANON_KEY,adminKey:local.SERVICE_ROLE_KEY,environment:'sandbox',fetcher:transport};
 let runtime;
 try{
 if(process.env.IDENTITY_CONTAINER_IMAGE){
  stage='container-start';const {startIdentityContainer}=await import('./identity-container.mjs');runtime=await startIdentityContainer(config);
 }else{
  const {startTelemetry}=await import('../../apps/identity-service/src/telemetry.ts');
  const telemetry=startTelemetry(telemetryEndpoint,'sandbox',1);
  const server=createIdentityServer(config);server.listen(0,'127.0.0.1');await once(server,'listening');
  runtime={origin:'http://127.0.0.1:'+server.address().port,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await telemetry.shutdown();}};
 }
 }catch(error){receiver.closeAllConnections();await new Promise(resolve=>receiver.close(resolve));throw error;}
 const {origin}=runtime;
 const execute=async(lease,key,token=jwt)=>{
  const correlation=randomUUID();correlations.push(correlation);
  const r=await fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:JSON.stringify({lease,idempotency_key:key,correlation_id:correlation}),signal:AbortSignal.timeout(20000)});
  assert.equal(r.headers.get('x-correlation-id'),correlation);
  assert.match(r.headers.get('x-request-id'),/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
  const data=await r.json();assert(!JSON.stringify(data).includes(local.SERVICE_ROLE_KEY));assert(!('password' in data));return {status:r.status,data};
 };
 try{
  stage='lease-and-mfa-negative';const lease=await newLease('first');
  assert.equal((await execute(lease,'finish-first',aal1)).status,403);assert.deepEqual(observed,{reads:0,creates:0});
  stage='foreign-tenant-negative';assert.equal((await execute({...lease,tenant_id:otherTenant},'foreign')).status,403);assert.deepEqual(observed,{reads:0,creates:0});
  stage='reserved-id-tamper-negative';assert.equal((await execute({...lease,intended_auth_user_id:randomUUID()},'tamper')).status,400);assert.deepEqual(observed,{reads:0,creates:0});
  stage='real-auth-provision';const first=await execute(lease,'finish-first');assert.equal(first.status,200);assert.equal(first.data.status,'completed');assert.equal(observed.creates,1);
  stage='historical-http-replay';const before={...observed},replay=await execute(lease,'finish-first');assert.deepEqual(replay.data,first.data);assert.deepEqual(observed,before);
  stage='different-key-terminal';assert.equal((await execute(lease,'different')).status,409);assert.deepEqual(observed,before);
  stage='real-auth-timeout-reconciliation';const recoveryLease=await newLease('recovery');loseCreateResponse=true;
  const recovery=await execute(recoveryLease,'finish-recovery');assert.equal(recovery.status,200);assert.equal(observed.creates,2);
  stage='concurrent-http-finalization';const raceLease=await newLease('race');
  const results=await Promise.all(Array.from({length:4},()=>execute(raceLease,'finish-race')));
  console.log(JSON.stringify({concurrent_http_statuses:results.map(r=>r.status)}));
  assert(results.every(r=>r.status===200));assert.equal(new Set(results.map(r=>r.data.resource_id)).size,1);
  stage='database-readback';const facts=JSON.parse(sql(`select jsonb_build_object(
   'principals',(select count(*) from private.flexexa_machine_principals where tenant_id='${tenant}'),
   'completions',(select count(*) from private.flexexa_identity_provisioning_completions where tenant_id='${tenant}'),
   'grants',(select count(*) from public.api_client_permissions where tenant_id='${tenant}'),
   'machine_sessions',(select count(*) from auth.sessions s join private.flexexa_machine_principals p on p.auth_user_id=s.user_id where p.tenant_id='${tenant}'),
   'reserved_ids_match',(select bool_and(p.auth_user_id=r.intended_auth_user_id) from private.flexexa_identity_provisioning_completions c
    join private.flexexa_identity_provisioning_requests r on r.id=c.request_id join private.flexexa_machine_principals p on p.id=c.principal_id where c.tenant_id='${tenant}'))`));
  assert.deepEqual(facts,{principals:3,completions:3,grants:0,machine_sessions:0,reserved_ids_match:true});
  stage='committed-revocation';sql(`update private.flexexa_machine_principals set status='revoked' where id=${q(first.data.principal_id)}`);
  assert.deepEqual((await execute(lease,'finish-first')).data,first.data);
  stage='current-membership-revocation';sql(`update public.memberships set status='suspended' where id='${member}'`);
  const counts={...observed};assert.equal((await execute(lease,'finish-first')).status,403);assert.deepEqual(observed,counts);
  console.log(JSON.stringify({real_auth_mfa:true,http_provisioning:true,real_reserved_auth_subjects:3,lost_create_response_reconciled:true,concurrent_http_calls:4,facts}));
 }finally{
  try{await runtime.close();
   stage='real-auth-otlp-readback';
   const spans=batches.flatMap(b=>b.resourceSpans.flatMap(r=>r.scopeSpans.flatMap(s=>s.spans)));
   const attr=(span,key)=>span.attributes.find(a=>a.key===key)?.value?.stringValue;
   const servers=spans.filter(s=>s.kind===2&&s.name==='POST /v1/identity/provisioning/execute');
   assert.equal(servers.length,correlations.length);
   assert.deepEqual(new Set(servers.map(s=>attr(s,'flexexa.correlation_id'))),new Set(correlations));
   for(const name of ['supabase.rpc','supabase.auth']){
    const clients=spans.filter(s=>s.kind===3&&s.name===name);assert(clients.length>0);
    assert(clients.every(c=>servers.some(s=>s.traceId===c.traceId&&s.spanId===c.parentSpanId)));
   }
   const wire=JSON.stringify(batches);
   for(const sensitive of [local.SERVICE_ROLE_KEY,local.ANON_KEY,jwt,aal1,email,password,tenant,actor,factor.totp.secret])assert(!wire.includes(sensitive));
   console.log(JSON.stringify({real_auth_otlp:true,request_spans:servers.length,upstream_spans:spans.filter(s=>s.kind===3).length,private_values_absent:true}));
  }finally{receiver.closeAllConnections();await new Promise(resolve=>receiver.close(resolve));}
 }
}
try{await main();}catch{console.error('IDENTITY_AUTH_INTEGRATION_FAILED at '+stage);process.exitCode=1;}
