import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {promisify} from 'node:util';
if(process.env.ALLOW_ISOLATED_RUNTIME_TESTS!=='1')throw Error('Refusing non-disposable runtime verification');
const exec=promisify(execFile),root=resolve(import.meta.dirname,'../..');
const directory=mkdtempSync(join(tmpdir(),'flexexa-valkey-'));
const project='flexexa-valkey-'+randomBytes(6).toString('hex');
const secrets=Object.fromEntries(['health','tenant_a','tenant_b'].map(user=>[user,randomBytes(32).toString('hex')]));
const tenants={tenant_a:'ca000000-0000-4000-8000-000000000001',tenant_b:'ca000000-0000-4000-8000-000000000002'};
const prefix=user=>`flexexa:ci:tenant:${tenants[user]}:`;
const hash=s=>createHash('sha256').update(s).digest('hex');
const acl=['user default off',`user health on #${hash(secrets.health)} -@all +ping`,
 ...Object.entries(tenants).map(([user])=>`user ${user} on #${hash(secrets[user])} ~${prefix(user)}* -@all +ping +get +set +del +pttl +pexpire +eval`)];
const aclPath=join(directory,'users.acl');writeFileSync(aclPath,acl.join('\n')+'\n',{mode:0o644});
const env={...process.env,FLEXEXA_VALKEY_ACL_FILE:aclPath,FLEXEXA_VALKEY_HEALTH_PASSWORD:secrets.health};
const compose=['compose','--project-name',project,'--file',resolve(root,'infra/docker/compose.yml')];
const sanitize=s=>Object.values(secrets).reduce((v,secret)=>v.replaceAll(secret,'[redacted]'),s);
async function run(args,overrides={},allowFailure=false){
 try{const r=await exec('docker',args,{cwd:root,env:{...env,...overrides},encoding:'utf8',timeout:300000,maxBuffer:2*1024*1024});return {status:0,stdout:r.stdout.trim(),stderr:r.stderr.trim()};}
 catch(error){const result={status:error.code||1,stdout:sanitize(String(error.stdout||'')),stderr:sanitize(String(error.stderr||''))};if(allowFailure)return result;throw Error('VALKEY_RUNTIME_FAILED: '+result.stderr);}
}
async function cli(user,args,{password=secrets[user],fail=false}={}){
 return run([...compose,'exec','-T','-e','VALKEYCLI_AUTH','valkey','valkey-cli','-e','-2','--json','--user',user,...args],{VALKEYCLI_AUTH:password},fail);
}
async function command(user,...args){return JSON.parse((await cli(user,args)).stdout);}
const release=readFileSync(resolve(root,'infra/docker/valkey/release-lease.lua'),'utf8');
let started=false;
try{
 started=true;await run([...compose,'up','--detach','--wait','--wait-timeout','90']);
 const container=(await run([...compose,'ps','-q','valkey'])).stdout;assert.match(container,/^[a-f0-9]{12,64}$/u);
 const config=JSON.parse((await run(['inspect','--format','{{json .HostConfig}}',container])).stdout);
 assert.equal(config.ReadonlyRootfs,true);assert(config.CapDrop.includes('ALL'));assert(config.SecurityOpt.some(v=>v.startsWith('no-new-privileges')));
 assert.equal(Object.keys(config.PortBindings||{}).length,0);
 const networks=JSON.parse((await run(['inspect','--format','{{json .NetworkSettings.Networks}}',container])).stdout);
 assert.equal(Object.keys(networks).length,1);
 for(const network of Object.keys(networks))assert.equal((await run(['network','inspect','--format','{{.Internal}}',network])).stdout,'true');
 assert.equal((await run([...compose,'exec','-T','valkey','id','-u'])).stdout,'65532');
 assert.notEqual((await run([...compose,'exec','-T','valkey','touch','/readonly-probe'],{},true)).status,0);
 const version=(await run([...compose,'exec','-T','valkey','valkey-server','--version'])).stdout;
 assert.match(version,/v=9\.1\.2(?:\s|$)/u);
 assert.equal(await command('health','PING'),'PONG');
 for(const [user,args,password] of [
  ['default',['PING'],''],['tenant_a',['PING'],'wrong-ephemeral-password'],
  ['health',['GET',prefix('tenant_a')+'probe'],secrets.health],
  ['tenant_a',['SET',prefix('tenant_b')+'probe','forbidden'],secrets.tenant_a],
  ['tenant_a',['SET','flexexa:production:tenant:'+tenants.tenant_a+':probe','forbidden'],secrets.tenant_a],
  ['tenant_a',['CONFIG','GET','*'],secrets.tenant_a],['tenant_a',['FLUSHALL'],secrets.tenant_a],
 ])assert.notEqual((await cli(user,args,{password,fail:true})).status,0);
 const key=prefix('tenant_a')+'lease:asset:ca000000-0000-4000-8000-000000000010';
 const tokens=Array.from({length:24},()=>randomBytes(32).toString('hex'));
 const results=await Promise.all(tokens.map(token=>command('tenant_a','SET',key,token,'NX','PX','30000')));
 assert.equal(results.filter(value=>value==='OK').length,1);assert(results.every(value=>value==='OK'||value===null));
 const winner=tokens[results.indexOf('OK')];const ttl=await command('tenant_a','PTTL',key);assert(ttl>0&&ttl<=30000);
 assert.equal(await command('tenant_a','EVAL',release,'1',key,'wrong-owner'),0);
 assert.equal(await command('tenant_a','GET',key),winner);
 assert.equal(await command('tenant_a','EVAL',release,'1',key,winner),1);
 assert.equal(await command('tenant_a','EVAL',release,'1',key,winner),0);
 assert.equal(await command('tenant_b','SET',prefix('tenant_b')+'lease:asset:ca000000-0000-4000-8000-000000000010','independent','NX','PX','30000'),'OK');
 assert.equal(await command('tenant_a','SET',key,'expired-owner','NX','PX','50'),'OK');
 const expiryDeadline=Date.now()+5000;
 while(await command('tenant_a','GET',key)!==null){assert(Date.now()<expiryDeadline,'lease must expire');await new Promise(r=>setTimeout(r,25));}
 assert.equal(await command('tenant_a','SET',key,'replacement-owner','NX','PX','30000'),'OK');
 assert.equal(await command('tenant_a','EVAL',release,'1',key,'expired-owner'),0);
 assert.equal(await command('tenant_a','GET',key),'replacement-owner');
 assert.notEqual((await cli('tenant_a',['EVAL',release,'1',key,''],{fail:true})).status,0);
 assert.notEqual((await cli('tenant_a',['EVAL',release,'1',prefix('tenant_b')+'probe','token'],{fail:true})).status,0);
 const image=(await run(['inspect','--format','{{.Image}}',container])).stdout;
 await run([...compose,'restart','valkey']);await run([...compose,'up','--detach','--wait','--wait-timeout','90']);
 assert.equal(await command('tenant_a','GET',key),null,'cache restart must not pretend to preserve business state');
 await run([...compose,'stop','--timeout','10','valkey']);
 assert.equal((await run(['inspect','--format','{{.State.ExitCode}}',container])).stdout,'0');
 const report={image,server_version:version,healthy:true,non_root_uid:65532,read_only:true,published_ports:0,internal_network:true,acl_negative_cases:9,
  concurrent_lease_calls:24,unique_lease_winner:true,expired_owner_cannot_release_replacement:true,
  cache_restart_loses_state:true,clean_shutdown:true,production_deployed:false,physical_commands_sent:0};
 mkdirSync(resolve(root,'.flexexa/index'),{recursive:true});writeFileSync(resolve(root,'.flexexa/index/valkey-runtime.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{
 try{if(started)await run([...compose,'down','--volumes','--remove-orphans']);}finally{rmSync(directory,{recursive:true,force:true});}
}
