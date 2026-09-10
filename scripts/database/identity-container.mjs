import assert from 'node:assert/strict';
import {execFile,execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer as tlsServer} from 'node:https';
import {createServer as tcpServer} from 'node:net';
import {once} from 'node:events';
import {promisify} from 'node:util';
const exec=promisify(execFile);
// Isolated CI fixture only. The image uses the unmodified production HTTPS entrypoint.
export async function startIdentityContainer(config){
 assert.equal(process.env.ALLOW_ISOLATED_DB_TESTS,'1');assert.equal(config.url,'http://127.0.0.1:54321');
 const image=process.env.IDENTITY_CONTAINER_IMAGE;assert.match(image,/^flexexa-identity:[a-z0-9-]+$/u);
 const temp=mkdtempSync(join(tmpdir(),'flexexa-identity-'));let container,proxy;
 const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:60000}).trim();
 async function cleanup(){
  try{if(container)docker(['rm','--force',container]);}finally{
   if(proxy){proxy.closeAllConnections();await new Promise(resolve=>proxy.close(resolve));}
   rmSync(temp,{recursive:true,force:true});
  }
 }
 try{
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(temp,'key.pem'),'-out',join(temp,'ca.pem'),
   '-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1'],{stdio:'ignore',timeout:30000});
  proxy=tlsServer({key:readFileSync(join(temp,'key.pem')),cert:readFileSync(join(temp,'ca.pem'))},async(req,res)=>{
   try{
    assert(req.url.startsWith('/auth/v1/admin/users')||req.url.startsWith('/rest/v1/rpc/'));
    const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;assert(size<=65536);chunks.push(chunk);}
    const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];
    const upstream=await config.fetcher(config.url+req.url,{method:req.method,headers,redirect:'error',signal:AbortSignal.timeout(5000),
     ...(chunks.length?{body:Buffer.concat(chunks)}:{})});
    res.statusCode=upstream.status;res.setHeader('Content-Type','application/json');res.end(Buffer.from(await upstream.arrayBuffer()));
   }catch{res.destroy();}
  });
  proxy.listen(0,'127.0.0.1');await once(proxy,'listening');
  const reservation=tcpServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
  const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const env={SUPABASE_URL:'https://127.0.0.1:'+proxy.address().port,SUPABASE_PUBLISHABLE_KEY:config.publishableKey,
   SUPABASE_AUTH_ADMIN_KEY:config.adminKey,FLEXEXA_ENVIRONMENT:config.environment,PORT:String(port),OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:config.telemetryEndpoint,FLEXEXA_TRACE_SAMPLE_RATIO:'1',NODE_EXTRA_CA_CERTS:'/run/fixture-ca.pem'};
  assert(Object.values(env).every(v=>typeof v==='string'&&!/[\r\n]/u.test(v)));
  writeFileSync(join(temp,'runtime.env'),Object.entries(env).map(([k,v])=>k+'='+v).join('\n'),{mode:0o600});
  container=docker(['run','-d','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--memory=256m','--cpus=1',
   '--network=host','--env-file',join(temp,'runtime.env'),'--mount','type=bind,source='+join(temp,'ca.pem')+',target=/run/fixture-ca.pem,readonly',image]);
  const origin='http://127.0.0.1:'+port;
  let healthy=false;
  for(let i=0;i<30;i++){
   const state=JSON.parse(docker(['inspect','--format','{{json .State}}',container]));
   assert.equal(state.Running,true);if(state.Health?.Status==='healthy'){healthy=true;break;}
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  assert(healthy);assert.equal((await fetch(origin+'/health/live')).status,200);
  const user=docker(['exec',container,'/nodejs/bin/node','-e','console.log(process.getuid())']);assert.notEqual(user,'0');
  const locked=docker(['inspect','--format','{{.HostConfig.ReadonlyRootfs}}',container]);assert.equal(locked,'true');
  return {origin,async close(){
   try{
    await exec('docker',['stop','--time=20',container],{timeout:30000});
    assert.equal(docker(['inspect','--format','{{.State.ExitCode}}',container]),'0');
    console.log(JSON.stringify({container_nonroot:true,container_readonly:true,https_upstream:true,healthcheck:true,sigterm_exit:0}));
   }finally{await cleanup();}
  }};
 }catch{await cleanup();throw Error('IDENTITY_CONTAINER_FIXTURE_FAILED');}
}
