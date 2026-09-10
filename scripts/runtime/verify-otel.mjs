import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {createServer as tcpServer} from 'node:net';
import {once} from 'node:events';
import {networkInterfaces} from 'node:os';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {startTelemetry} from '../../apps/identity-service/src/telemetry.ts';
import {createIdentityServer} from '../../apps/identity-service/src/server.ts';
if(process.env.ALLOW_ISOLATED_RUNTIME_TESTS!=='1')throw Error('Refusing non-disposable runtime verification');
const root=resolve(import.meta.dirname,'../..'),exec=promisify(execFile),batches=[];
let refuse=false,rejected=0,container,telemetry,server;
const sink=createServer(async(req,res)=>{
 try{
  assert.equal(req.url,'/v1/traces');assert.match(req.headers['content-type'],/^application\/json/u);
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const data=JSON.parse(Buffer.concat(chunks).toString());
  if(refuse){rejected++;res.statusCode=503;}else batches.push(data);
  res.setHeader('Content-Type','application/json');res.end('{}');
 }catch{res.statusCode=400;res.end('{}');}
});
sink.listen(0,'127.0.0.1');await once(sink,'listening');
const reservations=[];
for(let i=0;i<3;i++){const s=tcpServer();s.listen(0,'127.0.0.1');await once(s,'listening');reservations.push(s);}
const [receiverPort,healthPort,metricsPort]=reservations.map(s=>s.address().port);
await Promise.all(reservations.map(s=>new Promise(resolve=>s.close(resolve))));
const env={...process.env,FLEXEXA_OTEL_RECEIVER_PORT:String(receiverPort),FLEXEXA_OTEL_HEALTH_PORT:String(healthPort),
 FLEXEXA_OTEL_METRICS_PORT:String(metricsPort),FLEXEXA_OTEL_EXPORT_PORT:String(sink.address().port)};
const compose=['compose','--project-name','flexexa-otel-'+randomBytes(6).toString('hex'),'--file',resolve(root,'infra/docker/otel/compose.yml')];
async function run(args){const r=await exec('docker',args,{cwd:root,env,timeout:180000,maxBuffer:2*1024*1024});return (r.stdout+(args[0]==='logs'?r.stderr:'')).trim();}
async function waitFor(check){const end=Date.now()+15000;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('OTEL_CONDITION_TIMEOUT');}
async function healthy(){try{return (await fetch('http://127.0.0.1:'+healthPort,{signal:AbortSignal.timeout(500)})).status===200;}catch{return false;}}
const spans=()=>batches.flatMap(b=>b.resourceSpans.flatMap(r=>r.scopeSpans.flatMap(s=>s.spans)));
const correlation=s=>s.attributes?.find(a=>a.key==='flexexa.correlation_id')?.value?.stringValue;
try{
 await run([...compose,'run','--rm','collector','validate','--config=/etc/otelcol/config.yaml']);
 await run([...compose,'up','--detach']);
 container=await run([...compose,'ps','-q','collector']);assert.match(container,/^[a-f0-9]{12,64}$/u);
 await waitFor(healthy); // Official scratch image has no shell/HTTP client: actual external health probe before SDK startup.
 const info=JSON.parse(await run(['inspect',container]))[0];
 assert.equal(info.Config.User,'65532:65532');assert.equal(info.HostConfig.ReadonlyRootfs,true);
 assert(info.HostConfig.CapDrop.includes('ALL'));assert(info.HostConfig.SecurityOpt.some(s=>s.startsWith('no-new-privileges')));
 assert.equal(info.HostConfig.NetworkMode,'host');assert.equal(Object.keys(info.HostConfig.PortBindings||{}).length,0);
 const external=Object.values(networkInterfaces()).flat().find(a=>a.family==='IPv4'&&!a.internal);assert(external);
 for(const port of [receiverPort,healthPort,metricsPort])await assert.rejects(()=>fetch('http://'+external.address+':'+port,{signal:AbortSignal.timeout(1000)}));
 const image=JSON.parse(await run(['image','inspect',info.Image]))[0];
 assert(image.RepoDigests.length>0);console.log(JSON.stringify({collector_candidate_image:info.Image,repo_digests:image.RepoDigests}));
 telemetry=startTelemetry('http://127.0.0.1:'+receiverPort+'/v1/traces','sandbox',1);
 const secret='ISOLATED_PRIVATE_OTEL_VALUE';
 server=createIdentityServer({url:'https://example.supabase.co',publishableKey:secret,adminKey:secret,environment:'sandbox',logSink:()=>{},fetcher:async()=>{throw Error(secret);}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 async function healthRequest(){const id=randomUUID();const r=await fetch(origin+'/health/live',{headers:{'x-correlation-id':id}});assert.equal(r.status,200);await r.text();await telemetry.forceFlush();return id;}
 const first=await healthRequest();await waitFor(()=>spans().some(s=>correlation(s)===first));
 const id=()=>randomUUID(),correlationId=id();
 const input={lease:{tenant_id:id(),environment:'sandbox',resource_type:'identity_execution_lease',resource_id:id(),request_id:id(),generation:1,
  api_client_id:id(),intended_auth_user_id:id(),expires_at:'2099-01-01T00:00:00.000000Z',correlation_id:correlationId,idempotency_key:'lease',status:'leased'},idempotency_key:'finish',correlation_id:correlationId};
 const denied=await fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify(input)});
 assert.equal(denied.status,502);await denied.text();await telemetry.forceFlush();
 await waitFor(()=>spans().some(s=>correlation(s)===correlationId));
 const parent=spans().find(s=>correlation(s)===correlationId);
 assert(spans().some(s=>s.name==='supabase.rpc'&&s.kind===3&&s.traceId===parent.traceId&&s.parentSpanId===parent.spanId));
 const malformed=await fetch('http://127.0.0.1:'+receiverPort+'/v1/traces',{method:'POST',headers:{'Content-Type':'application/json'},body:'invalid'});assert.equal(malformed.status,400);await malformed.text();
 const disabled=await fetch('http://127.0.0.1:'+receiverPort+'/v1/logs',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(disabled.status,404);await disabled.text();
 refuse=true;const retried=await healthRequest();await waitFor(()=>rejected>0);
 assert.equal(await healthy(),true);refuse=false;
 await waitFor(()=>spans().some(s=>correlation(s)===retried));
 assert.equal(spans().filter(s=>correlation(s)===retried).length,1);
 const metrics=await (await fetch('http://127.0.0.1:'+metricsPort+'/metrics')).text();assert.match(metrics,/otelcol_receiver_accepted_spans/u);assert.match(metrics,/otelcol_exporter_sent_spans/u);
 await run([...compose,'restart','collector']);await waitFor(healthy);
 assert.equal(await run([...compose,'ps','-q','collector']),container);
 const afterRestart=await healthRequest();await waitFor(()=>spans().some(s=>correlation(s)===afterRestart));
 const encoded=JSON.stringify(batches);for(const value of [secret,'example.supabase.co',input.lease.tenant_id,input.lease.intended_auth_user_id])assert(!encoded.includes(value));
 await new Promise(resolve=>server.close(resolve));server=undefined;await telemetry.shutdown();telemetry=undefined;
 await run([...compose,'stop','--timeout','10','collector']);
 assert.equal(await run(['inspect','--format','{{.State.ExitCode}}',container]),'0');
 const report={image:info.Image,repo_digests:image.RepoDigests,non_root:true,read_only:true,loopback_only:true,health_before_sdk:true,
  actual_sdk_collector_roundtrip:true,parentage_preserved:true,malformed_rejected:true,unused_signal_disabled:true,
  temporary_export_failure_recovered:true,prometheus_self_metrics:true,restart_roundtrip:true,private_values_absent:true,graceful_shutdown:true,
  span_count:spans().length,durable_delivery:false,production_deployed:false};
 mkdirSync(resolve(root,'.flexexa/index'),{recursive:true});writeFileSync(resolve(root,'.flexexa/index/otel-runtime.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}catch(error){if(container)console.error((await run(['logs','--tail','30',container])).replaceAll('ISOLATED_PRIVATE_OTEL_VALUE','[redacted]'));throw error;}
finally{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(telemetry)await telemetry.shutdown();
 try{await run([...compose,'down','--remove-orphans']);}finally{sink.closeAllConnections();await new Promise(resolve=>sink.close(resolve));}
}
