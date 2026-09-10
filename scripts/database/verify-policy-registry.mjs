import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {ensureSourceWorkspace} from './source-workspace.mjs';
for(const [k,v] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'}))if(process.env[k]!==v)throw Error('Refusing non-disposable policy verification');
ensureSourceWorkspace();
const {intersectPowerPolicy}=await import('../../packages/kernel/src/index.ts');
const args=['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-XAtq','--set=ON_ERROR_STOP=1'];
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=s=>execFileSync('psql',[...args,'--command',s],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
const asyncSql=async s=>(await promisify(execFile)('psql',[...args,'--command',s],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024})).stdout.trim();
const [author,approver,sessionA,sessionB,org,tenant,membershipA,membershipB,correlation]=Array.from({length:9},()=>randomUUID());
sql(`insert into auth.users(id,is_anonymous) values('${author}',false),('${approver}',false);
insert into auth.sessions(id,user_id) values('${sessionA}','${author}'),('${sessionB}','${approver}');
insert into public.organizations(id,name,slug) values('${org}','Policy integration','${org}');
insert into public.tenants(id,organization_id,name,slug) values('${tenant}','${org}','Policy integration','${tenant}');
insert into public.platform_memberships(id,user_id) values('${membershipA}','${author}'),('${membershipB}','${approver}');
insert into public.platform_membership_roles(platform_membership_id,role_id) select m.id,r.id from public.platform_memberships m cross join public.roles r where m.id in('${membershipA}','${membershipB}') and r.scope_type='platform' and r.role_key='platform_admin';`);
const transaction=(who,s)=>`begin;set local role authenticated;set local request.jwt.claims=${q(JSON.stringify({sub:who===1?author:approver,session_id:who===1?sessionA:sessionB,role:'authenticated',aal:'aal2'}))};${s};commit;`;
const call=(action,payload,idem)=>`select private.flexexa_policy_workflow(${q(action)},${q(JSON.stringify(payload))}::jsonb,${q(idem)},'${correlation}')`;
const invoke=async(who,action,payload,idem)=>JSON.parse(await asyncSql(transaction(who,call(action,payload,idem))));
const valid_from='2026-01-01T00:00:00.000Z',valid_until='2099-01-01T00:00:00.000Z';
const payload={policy_key:'race.'+author.replaceAll('-',''),name:'Race policy',valid_from,valid_until,tenants:[tenant],rules:[
 {rule_key:'rule.'+author.replaceAll('-',''),expression:{minimum_kw:2,maximum_kw:7,deny_reasons:[]},tests:[{name:'below',requested_kw:1,expected_allowed:false},{name:'inside',requested_kw:3,expected_allowed:true}]},
 {rule_key:'rule.'+approver.replaceAll('-',''),expression:{minimum_kw:0,maximum_kw:5,deny_reasons:[]},tests:[{name:'above',requested_kw:6,expected_allowed:false},{name:'edge',requested_kw:5,expected_allowed:true}]}]};
const created=await Promise.all(Array.from({length:16},()=>invoke(1,'create',payload,'create')));
assert.ok(created.every(x=>JSON.stringify(x)===JSON.stringify(created[0])));
const version={policy_set_version_id:created[0].policy_set_version_id};
assert.equal(sql(`select count(*) from public.policy_set_versions where id='${version.policy_set_version_id}'`),'1');
assert.equal((await invoke(1,'test',version,'test')).passed,true);
// Compare actual persisted rules with the canonical Kernel intersection.
const rows=JSON.parse(sql(`select jsonb_agg(jsonb_build_object('rule_version_id',r.id,'minimum_kw',r.expression_json->'minimum_kw','maximum_kw',r.expression_json->'maximum_kw')) from public.rule_versions r join public.policy_set_rule_versions m on m.rule_version_id=r.id where m.policy_set_version_id='${version.policy_set_version_id}'`));
const compiled={tenant_id:tenant,policy_set_version_id:version.policy_set_version_id,valid_from,valid_until,limits:rows,deny_reasons:[]};
const result=intersectPowerPolicy(compiled,tenant,'2026-09-10T00:00:00.000Z');
assert.deepEqual(result.constraints_json,{minimum_kw:2,maximum_kw:5});
const observations=[0,1,2,3,5,6,7,8].map(requested_kw=>({requested_kw,expected_allowed:result.allowed&&requested_kw>=result.constraints_json.minimum_kw&&requested_kw<=result.constraints_json.maximum_kw}));
assert.equal((await invoke(1,'shadow',{...version,observations},'shadow')).passed,true);
await invoke(2,'approve',version,'approve');
const published=await Promise.all(Array.from({length:16},()=>invoke(2,'publish',version,'publish')));
assert.ok(published.every(x=>x.status==='published'));
assert.equal(sql(`select count(*) from public.outbox_events where tenant_id='${tenant}' and payload_json->>'policy_set_version_id'='${version.policy_set_version_id}'`),'1');
assert.equal(sql(`select count(*) from public.tenant_policy_readiness where tenant_id='${tenant}'`),'1');
// A real blocking lock lets the session expire after initial authorization.
const second=await invoke(1,'create',payload,'create-second');
const secondVersion={policy_set_version_id:second.policy_set_version_id};
const policy=sql(`select policy_set_id from public.policy_set_versions where id='${second.policy_set_version_id}'`);
const blockerName='policy-lock-'+randomUUID();
const blocker=asyncSql(`set application_name=${q(blockerName)};begin;select id from public.policy_sets where id='${policy}' for update;select pg_sleep(3);commit;`);
let acquired=false;
for(let attempt=0;attempt<100;attempt++){
 if(sql(`select count(*) from pg_stat_activity where application_name=${q(blockerName)} and wait_event='PgSleep'`)==='1'){acquired=true;break;}
 await new Promise(resolve=>setTimeout(resolve,20));
}
assert.equal(acquired,true);
sql(`update auth.sessions set not_after=clock_timestamp()+interval '1 second' where id='${sessionA}'`);
await assert.rejects(invoke(1,'test',secondVersion,'expires-waiting'),/PERMISSION_DENIED/);
await blocker;
assert.equal(sql(`select status from public.policy_set_versions where id='${second.policy_set_version_id}'`),'draft');
assert.equal(sql(`select count(*) from public.idempotency_records where scope_type='platform' and actor_id='${author}' and idempotency_key='expires-waiting'`),'0');
console.log(JSON.stringify({policyRegistry:{createRaces:16,publishRaces:16,kernelParity:observations.length,expiredSessionAfterRealLock:'denied',atomicEvidence:true}}));
