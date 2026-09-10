import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {chmodSync,mkdirSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {createServer as tcpServer} from 'node:net';
import {networkInterfaces,tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {promisify} from 'node:util';
import {startTelemetry} from '../../apps/identity-service/src/telemetry.ts';
import {createIdentityServer} from '../../apps/identity-service/src/server.ts';
if(process.env.ALLOW_ISOLATED_RUNTIME_TESTS!=='1')throw Error('Refusing non-disposable observability verification');
const root=resolve(import.meta.dirname,'../..'),exec=promisify(execFile);
const temporary=mkdtempSync(resolve(tmpdir(),'flexexa-observability-')),storage=resolve(temporary,'queue');
assert(temporary.startsWith(resolve(tmpdir(),'flexexa-observability-')));mkdirSync(storage,{mode:0o700});
const passwords=Object.fromEntries(['fixture_admin','trace_writer','ops_sandbox','ops_production','unassigned'].map(u=>[u,randomBytes(32).toString('hex')]));
const hash=s=>createHash('sha256').update(s).digest('hex'),users=resolve(temporary,'users.xml');
writeFileSync(users,`<clickhouse><profiles><default><max_threads>2</max_threads><max_memory_usage>536870912</max_memory_usage><log_queries>0</log_queries></default><health><readonly>1</readonly></health></profiles>
<users><fixture_admin><password_sha256_hex>${hash(passwords.fixture_admin)}</password_sha256_hex><networks><ip>0.0.0.0/0</ip></networks><profile>default</profile><quota>default</quota><access_management>1</access_management></fixture_admin>
<health><password></password><networks><ip>127.0.0.1</ip></networks><profile>health</profile><quota>default</quota><allow_databases><database>system</database></allow_databases></health></users>
<quotas><default><interval><duration>3600</duration><queries>0</queries><errors>0</errors><result_rows>0</result_rows><read_rows>0</read_rows><execution_time>0</execution_time></interval></default></quotas></clickhouse>`);chmodSync(users,0o644);
const env={...process.env,FLEXEXA_CLICKHOUSE_USERS:users,FLEXEXA_OTEL_STORAGE:storage,FLEXEXA_TRACE_WRITER_PASSWORD:passwords.trace_writer};
const project='flexexa-observe-'+randomBytes(6).toString('hex');
const dbCompose=['compose','--project-name',project+'-db','--file',resolve(root,'infra/docker/clickhouse/compose.yml')];
const collectorCompose=['compose','--project-name',project+'-collector','--file',resolve(root,'infra/docker/observability/compose.yml')];
let database,collector,server,telemetry,port,report,storageOwned=false;
async function command(binary,args){try{return (await exec(binary,args,{cwd:root,env,timeout:180000,maxBuffer:2*1024*1024})).stdout.trim();}catch(error){
 if(binary==='docker'&&args.includes('validate')){
  let diagnostic=String(error.stderr??'');for(const value of Object.values(passwords))diagnostic=diagnostic.replaceAll(value,'[redacted]');
  console.error(diagnostic.slice(-3000)); // Configuration validation only, before SDK/data ingress.
 }
 throw Error('OBSERVABILITY_COMMAND_FAILED_'+binary);
}}
const docker=args=>command('docker',args);
async function waitFor(check,label){const end=Date.now()+30000;while(Date.now()<end){if(await check())return;await new Promise(r=>setTimeout(r,100));}throw Error('OBSERVABILITY_TIMEOUT_'+label);}
async function sql(query,user='fixture_admin',denied=false,schemaDiagnostic=false){
 const response=await fetch('http://127.0.0.1:'+port+'/',{method:'POST',headers:{'X-ClickHouse-User':user,'X-ClickHouse-Key':passwords[user]??''},body:query,signal:AbortSignal.timeout(15000)});
 const body=await response.text();
 if(denied){assert(!response.ok,'Expected SQL denial');const code=Number(body.match(/Code: ([0-9]+)\./u)?.[1]);assert((Array.isArray(denied)?denied:[164,194,195,497,516]).includes(code),'UNEXPECTED_DENIAL_CODE_'+code);return '';}
 if(!response.ok&&schemaDiagnostic)console.error(body.slice(0,4000)); // Tracked DDL only; never row/credential SQL.
 if(!response.ok)throw Error('OBSERVABILITY_SQL_FAILED_'+response.status+'_'+(body.match(/Code: ([0-9]+)/u)?.[1]??'UNKNOWN'));
 return body.trim();
}
const traceCount=(id,user='ops_sandbox')=>sql(`SELECT count() FROM flexexa.otel_traces_v1 FINAL WHERE TraceId='${id}'`,user);
try{
 // Only the dedicated disposable queue path changes owner. No privileged service.
 await command('sudo',['chown','65532:65532',storage]);storageOwned=true;
 const reservations=[];for(let i=0;i<3;i++){const s=tcpServer();s.listen(0,'127.0.0.1');await once(s,'listening');reservations.push(s);}
 const [receiverPort,healthPort,metricsPort]=reservations.map(s=>s.address().port);
 await Promise.all(reservations.map(s=>new Promise(r=>s.close(r))));
 Object.assign(env,{FLEXEXA_OTEL_RECEIVER_PORT:String(receiverPort),FLEXEXA_OTEL_HEALTH_PORT:String(healthPort),FLEXEXA_OTEL_METRICS_PORT:String(metricsPort)});
 await docker([...dbCompose,'up','-d','--wait','--wait-timeout','120']);database=await docker([...dbCompose,'ps','-q','clickhouse']);assert.match(database,/^[a-f0-9]{12,64}$/u);
 port=Number((await docker([...dbCompose,'port','clickhouse','8123'])).split(':').at(-1));env.FLEXEXA_CLICKHOUSE_PORT=String(port);
 const databaseInfo=JSON.parse(await docker(['inspect',database]))[0];
 assert.equal(databaseInfo.Config.User,'101:101');assert.equal(databaseInfo.HostConfig.ReadonlyRootfs,true);
 assert(databaseInfo.HostConfig.PortBindings['8123/tcp'].every(p=>p.HostIp==='127.0.0.1'));
 assert.equal(await sql('SELECT version()'),'26.8.2.7');await sql('CREATE DATABASE flexexa');
 const migrations={};for(const name of readdirSync(resolve(root,'infra/clickhouse/migrations')).sort()){
  const source=readFileSync(resolve(root,'infra/clickhouse/migrations',name),'utf8');await sql(source,'fixture_admin',false,true);migrations[name]=hash(source);
 }
 await sql('CREATE ROW POLICY admin_traces ON flexexa.otel_traces_v1 USING 1 TO fixture_admin');
 for(const user of ['trace_writer','ops_sandbox','ops_production','unassigned'])await sql(`CREATE USER ${user} IDENTIFIED WITH sha256_hash BY '${hash(passwords[user])}' SETTINGS readonly=${user==='trace_writer'?0:1}`);
 await sql('GRANT INSERT ON flexexa.otel_traces_v1 TO trace_writer');
 for(const user of ['ops_sandbox','ops_production','unassigned'])await sql(`GRANT SELECT ON flexexa.otel_traces_v1 TO ${user}`);
 await sql("CREATE ROW POLICY sandbox_traces ON flexexa.otel_traces_v1 USING Environment='sandbox' TO ops_sandbox");
 await sql("CREATE ROW POLICY production_traces ON flexexa.otel_traces_v1 USING Environment='production' TO ops_production");
 for(const query of ['SELECT * FROM flexexa.otel_traces_v1','TRUNCATE TABLE flexexa.otel_traces_v1','DROP TABLE flexexa.otel_traces_v1','INSERT INTO flexexa.telemetry_v1 SELECT * FROM flexexa.telemetry_v1'])await sql(query,'trace_writer',true);
 await sql('SELECT 1','default',true);
 // Capture the actual candidate image before configuration validation, then pin it.
 await docker([...collectorCompose,'pull','collector']);
 const candidateImage=readFileSync(resolve(root,'infra/docker/observability/compose.yml'),'utf8').match(/^    image: (.+)$/mu)[1];
 const image=JSON.parse(await docker(['image','inspect',candidateImage]))[0];
 console.log(JSON.stringify({observability_candidate_image:image.Id,repo_digests:image.RepoDigests}));
 await docker([...collectorCompose,'run','--rm','collector','validate','--config=/etc/otelcol/config.yaml']);
 await docker([...collectorCompose,'up','-d']);collector=await docker([...collectorCompose,'ps','-q','collector']);
 const healthy=async()=>{try{return (await fetch('http://127.0.0.1:'+healthPort,{signal:AbortSignal.timeout(500)})).status===200;}catch{return false;}};
 await waitFor(healthy,'HEALTH');
 const info=JSON.parse(await docker(['inspect',collector]))[0];
 assert.equal(info.Config.User,'65532:65532');assert.equal(info.HostConfig.ReadonlyRootfs,true);assert(info.HostConfig.CapDrop.includes('ALL'));
 assert(info.HostConfig.SecurityOpt.some(x=>x.startsWith('no-new-privileges')));assert.equal(info.HostConfig.NetworkMode,'host');
 assert(info.Mounts.some(m=>m.Source===storage&&m.Destination==='/var/lib/otelcol'&&m.RW));
 const external=Object.values(networkInterfaces()).flat().find(a=>a.family==='IPv4'&&!a.internal);assert(external);
 for(const p of [receiverPort,healthPort,metricsPort])await assert.rejects(()=>fetch('http://'+external.address+':'+p,{signal:AbortSignal.timeout(1000)}));
 const secret='ISOLATED_PRIVATE_TRACE_VALUE';
 telemetry=startTelemetry('http://127.0.0.1:'+receiverPort+'/v1/traces','sandbox',1);
 server=createIdentityServer({url:'https://example.supabase.co',publishableKey:secret,adminKey:secret,environment:'sandbox',logSink:()=>{},fetcher:async()=>{throw Error(secret);}});
 server.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+server.address().port;
 const correlationCount=id=>sql(`SELECT count() FROM flexexa.otel_traces_v1 FINAL WHERE SpanAttributes['flexexa.correlation_id']='${id}'`,'ops_sandbox');
 async function healthRequest(){const id=randomUUID();const r=await fetch(origin+'/health/live',{headers:{'x-correlation-id':id}});assert.equal(r.status,200);await r.text();await telemetry.forceFlush();return id;}
 const first=await healthRequest();await waitFor(async()=>await correlationCount(first)==='1','SDK_STORAGE');
 const correlationId=randomUUID();
 const input={lease:{tenant_id:randomUUID(),environment:'sandbox',resource_type:'identity_execution_lease',resource_id:randomUUID(),request_id:randomUUID(),generation:1,api_client_id:randomUUID(),intended_auth_user_id:randomUUID(),expires_at:'2099-01-01T00:00:00.000000Z',correlation_id:correlationId,idempotency_key:'lease',status:'leased'},idempotency_key:'finish',correlation_id:correlationId};
 const failed=await fetch(origin+'/v1/identity/provisioning/execute',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+secret},body:JSON.stringify(input)});assert.equal(failed.status,502);await failed.text();await telemetry.forceFlush();
 await waitFor(async()=>await correlationCount(correlationId)==='1','FAILED_REQUEST');
 const parent=JSON.parse(await sql(`SELECT TraceId,SpanId FROM flexexa.otel_traces_v1 FINAL WHERE SpanAttributes['flexexa.correlation_id']='${correlationId}' FORMAT JSONEachRow`,'ops_sandbox'));
 assert.equal(await sql(`SELECT count() FROM flexexa.otel_traces_v1 FINAL WHERE TraceId='${parent.TraceId}' AND ParentSpanId='${parent.SpanId}' AND SpanName='supabase.rpc'`,'ops_sandbox'),'1');
 const probeTrace=randomBytes(16).toString('hex'),probeSpan=randomBytes(8).toString('hex'),now=BigInt(Date.now())*1000000n;
 const probe={resourceSpans:[{resource:{attributes:[{key:'service.name',value:{stringValue:'flexexa-identity'}},{key:'service.version',value:{stringValue:'0.0.0'}},{key:'deployment.environment.name',value:{stringValue:'sandbox'}},{key:'private.resource',value:{stringValue:secret}}]},scopeSpans:[{scope:{name:'flexexa.identity',version:'1'},spans:[{traceId:probeTrace,spanId:probeSpan,name:'privacy-probe',kind:2,startTimeUnixNano:String(now),endTimeUnixNano:String(now+1n),attributes:[{key:'private.attribute',value:{stringValue:secret}}]}]}]}]};
 const exported=await fetch('http://127.0.0.1:'+receiverPort+'/v1/traces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(probe)});assert.equal(exported.status,200);await exported.text();await waitFor(async()=>await traceCount(probeTrace)==='1','FILTERED_PROBE');
 // Exact exporter retry may duplicate a row. FINAL provides stable trace/span reads.
 const replayed=await fetch('http://127.0.0.1:'+receiverPort+'/v1/traces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(probe)});assert.equal(replayed.status,200);await replayed.text();
 const rejectedTraces=[];
 for(const kind of ['service','status','event','link']){
  const bad=structuredClone(probe),span=bad.resourceSpans[0].scopeSpans[0].spans[0];span.traceId=randomBytes(16).toString('hex');rejectedTraces.push(span.traceId);
  if(kind==='service')bad.resourceSpans[0].resource.attributes[0].value.stringValue='unknown-service';
  if(kind==='status')span.status={code:2,message:secret};
  if(kind==='event')span.events=[{timeUnixNano:String(now),name:secret}];
  if(kind==='link')span.links=[{traceId:randomBytes(16).toString('hex'),spanId:randomBytes(8).toString('hex'),traceState:secret}];
  const rejected=await fetch('http://127.0.0.1:'+receiverPort+'/v1/traces',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(bad)});assert.equal(rejected.status,200);await rejected.text();
 }
 const marker=await healthRequest();await waitFor(async()=>await correlationCount(marker)==='1','REPLAY_MARKER');assert.equal(await traceCount(probeTrace),'1');
 for(const id of rejectedTraces)assert.equal(await traceCount(id),'0');
 const stored=await sql('SELECT * FROM flexexa.otel_traces_v1 FINAL FORMAT JSONEachRow','ops_sandbox');
 for(const value of [secret,'example.supabase.co',input.lease.tenant_id,input.lease.intended_auth_user_id,'private.attribute','private.resource'])assert(!stored.includes(value));
 assert.equal(await sql('SELECT count() FROM flexexa.otel_traces_v1','unassigned'),'0');assert.equal(await sql('SELECT count() FROM flexexa.otel_traces_v1','ops_production'),'0');
 await sql('TRUNCATE TABLE flexexa.otel_traces_v1','ops_sandbox',true);
 const sample=JSON.parse(stored.split('\n')[0]);delete sample.Environment;delete sample.ReceivedAt;
 for(const kind of ['message','state','attribute']){
  const invalid=structuredClone(sample);invalid.TraceId=randomBytes(16).toString('hex');
  if(kind==='message')invalid.StatusMessage=secret;
  if(kind==='state')invalid.TraceState=secret;
  if(kind==='attribute')invalid.SpanAttributes['private.attribute']=secret;
  await sql('INSERT INTO flexexa.otel_traces_v1 FORMAT JSONEachRow\n'+JSON.stringify(invalid),'fixture_admin',[469]);
  assert.equal(await traceCount(invalid.TraceId),'0');
 }
 sample.TraceId=randomBytes(16).toString('hex');sample.ResourceAttributes['deployment.environment.name']='production';
 await sql('INSERT INTO flexexa.otel_traces_v1 FORMAT JSONEachRow\n'+JSON.stringify(sample));
 assert.equal(await traceCount(sample.TraceId),'0');assert.equal(await traceCount(sample.TraceId,'ops_production'),'1');
 // Queue a real SDK span while the destination is down; crash and replace the
 // collector process/container, preserving only its fsync-backed queue directory.
 await docker([...dbCompose,'stop','--timeout','20','clickhouse']);
 const queued=[];for(let i=0;i<96;i++)queued.push(await healthRequest());
 await waitFor(async()=>{const metrics=await (await fetch('http://127.0.0.1:'+metricsPort+'/metrics')).text();return metrics.split('\n').some(l=>/^otelcol_exporter_queue_size(?:\{|\s)/u.test(l)&&Number(l.split(' ').at(-1))>0);},'PERSISTENT_QUEUE');
 await docker(['kill','--signal','KILL',collector]);assert.equal(await docker(['inspect','--format','{{.State.ExitCode}}',collector]),'137');
 await docker([...dbCompose,'up','--no-recreate','-d','--wait','--wait-timeout','120','clickhouse']);
 assert.equal(await docker([...dbCompose,'ps','-q','clickhouse']),database);
 port=Number((await docker([...dbCompose,'port','clickhouse','8123'])).split(':').at(-1));
 assert(Number.isSafeInteger(port)&&port>0&&port<=65535);env.FLEXEXA_CLICKHOUSE_PORT=String(port);
 const restarted=JSON.parse(await docker(['inspect',database]))[0];
 assert(restarted.HostConfig.PortBindings['8123/tcp'].every(p=>p.HostIp==='127.0.0.1'));
 await docker([...collectorCompose,'up','-d','--force-recreate']);const replacement=await docker([...collectorCompose,'ps','-q','collector']);assert.notEqual(replacement,collector);collector=replacement;
 await waitFor(healthy,'REPLACEMENT_HEALTH');
 const queuedList=queued.map(id=>"'"+id+"'").join(',');
 await waitFor(async()=>await sql(`SELECT uniqExact(SpanAttributes['flexexa.correlation_id']) FROM flexexa.otel_traces_v1 FINAL WHERE SpanAttributes['flexexa.correlation_id'] IN (${queuedList})`,'ops_sandbox')==='96','CRASH_RECOVERY');
 assert.equal(await correlationCount(first),'1');assert.equal(await traceCount(sample.TraceId,'ops_production'),'1');
 // Exercise actual TTL deletion on an expired partition, then preserve current rows.
 const expired={...sample,TraceId:randomBytes(16).toString('hex'),Timestamp:'2020-01-01 00:00:00.000000000'};
 await sql('INSERT INTO flexexa.otel_traces_v1 FORMAT JSONEachRow\n'+JSON.stringify(expired));await sql('OPTIMIZE TABLE flexexa.otel_traces_v1 FINAL');
 assert.equal(await traceCount(expired.TraceId,'ops_production'),'0');assert.equal(await correlationCount(first),'1');
 await new Promise(r=>server.close(r));server=undefined;await telemetry.shutdown();telemetry=undefined;
 await docker([...collectorCompose,'stop','--timeout','10','collector']);assert.equal(await docker(['inspect','--format','{{.State.ExitCode}}',collector]),'0');
 report={collector_image:image.Id,collector_repo_digests:image.RepoDigests,clickhouse_image:databaseInfo.Image,migration_sha256:migrations,
  actual_sdk_collector_clickhouse:true,parentage_preserved:true,private_attributes_removed:true,free_text_and_unknown_service_dropped:4,database_privacy_rejections:3,writer_insert_only:true,unassigned_reader_denied:true,environment_reader_isolation:true,
  replay_final_read_deduplicated:true,persistent_queue_after_sigkill_and_replacement:true,recovered_queued_sdk_spans:96,database_restart_preserved_rows:true,retention_hours:72,expired_row_removed:true,
  non_root_read_only:true,loopback_only:true,graceful_shutdown:true,delivery_semantics:'at_least_once_after_collector_acceptance',
  production_deployed:false,host_disk_loss_recovery:false,tenant_rbac_integration:false};
}catch(error){
 // Error text is a bounded local code. Never echo SQL, configuration or container
 // logs, which may contain database passwords or rejected span content.
 console.error(/^OBSERVABILITY_[A-Z0-9_]+$/u.test(error.message)?error.message:'OBSERVABILITY_VERIFICATION_FAILED');throw error;
}finally{
 if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(telemetry)await telemetry.shutdown();
 try{await docker([...collectorCompose,'down','--remove-orphans']);}finally{
  try{await docker([...dbCompose,'down','--volumes','--remove-orphans']);}finally{
   if(storageOwned)await command('sudo',['chown','-R',`${process.getuid()}:${process.getgid()}`,storage]);rmSync(temporary,{recursive:true,force:true});
  }
 }
}
report.cleanup_verified=true;mkdirSync(resolve(root,'.flexexa/index'),{recursive:true});writeFileSync(resolve(root,'.flexexa/index/observability-storage.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
