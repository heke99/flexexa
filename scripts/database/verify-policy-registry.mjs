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
const observations=[0,1,1.999999,2,2.000001,3,4.999999,5,5.000001,6,7,8].map(requested_kw=>({requested_kw,expected_allowed:result.allowed&&requested_kw>=result.constraints_json.minimum_kw&&requested_kw<=result.constraints_json.maximum_kw}));
assert.equal((await invoke(1,'shadow',{...version,observations},'shadow')).passed,true);
await invoke(2,'approve',version,'approve');
const published=await Promise.all(Array.from({length:16},()=>invoke(2,'publish',version,'publish')));
assert.ok(published.every(x=>x.status==='published'));
assert.equal(sql(`select count(*) from public.outbox_events where tenant_id='${tenant}' and payload_json->>'policy_set_version_id'='${version.policy_set_version_id}'`),'1');
assert.equal(sql(`select count(*) from public.tenant_policy_readiness where tenant_id='${tenant}'`),'1');
// Same typed consumer path against PostgreSQL, and (in broker mode) real AMQP.
const {consumePolicyPublication}=await import('../../packages/events/src/inbox-consumption.ts');
const {deliverOutboxEvent}=await import('../../packages/events/src/outbox-delivery.ts');
const [consumer,consumerSession,consumerService,consumerBinding,publisher,publisherSession,publisherService,publisherBinding]=Array.from({length:8},()=>randomUUID());
sql(`insert into auth.users(id,is_anonymous) values('${consumer}',false),('${publisher}',false);
insert into auth.sessions(id,user_id) values('${consumerSession}','${consumer}'),('${publisherSession}','${publisher}');
insert into public.service_identities(id,service_key,name) values('${consumerService}','consumer-${consumerService}','Consumer'),('${publisherService}','publisher-${publisherService}','Publisher');
insert into private.flexexa_machine_principals(id,auth_user_id,principal_type,service_identity_id,environment) values('${consumerBinding}','${consumer}','service','${consumerService}','sandbox'),('${publisherBinding}','${publisher}','service','${publisherService}','sandbox');
insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json) select '${consumerService}','${tenant}',id,'{"environment":"sandbox"}' from public.permissions where permission_key='events.consume';
insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json) select '${publisherService}','${tenant}',id,'{"environment":"sandbox"}' from public.permissions where permission_key='events.publish';`);
const consumerClaims={sub:consumer,session_id:consumerSession,role:'authenticated',aal:'aal1'};
const machineTx=(claims,s)=>`begin;set local role authenticated;set local request.jwt.claims=${q(JSON.stringify(claims))};${s};commit;`;
const scope={tenant_id:tenant,environment:'sandbox'};
const captureEvent=(id,t)=>JSON.parse(sql(`select jsonb_build_object('event_id',e.id,'tenant_id',e.tenant_id,'organization_id',e.organization_id,'event_type',e.event_type,'event_version',e.event_version,
'occurred_at',to_char(e.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'received_at',to_char(e.received_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
'correlation_id',e.correlation_id,'causation_id',e.causation_id,'source',e.source,'payload',e.payload_json) from public.outbox_events e where e.tenant_id='${t}' and e.payload_json->>'policy_set_version_id'='${id}'`));
const event=captureEvent(version.policy_set_version_id,tenant);
assert.equal(event.event_type,'policy.version.published');
const inbox={consume:async(s,e)=>JSON.parse(await asyncSql(machineTx(consumerClaims,`select public.flexexa_consume_policy_publication(${q(s.tenant_id)},${q(s.environment)},${q(JSON.stringify(e))}::jsonb)`)))};
let brokerRecovery=false;
if(process.env.FLEXEXA_OUTBOX_BROKER_TEST==='1'){
 const broker=request=>JSON.parse(execFileSync(process.env.FLEXEXA_TEST_PYTHON,['scripts/runtime/rabbitmq/outbox-bridge.py'],{input:JSON.stringify(request),encoding:'utf8',timeout:25000,maxBuffer:1024*1024}));
 const publisherClaims={sub:publisher,session_id:publisherSession,role:'authenticated',aal:'aal1'};
 const db={claim:async s=>JSON.parse(await asyncSql(machineTx(publisherClaims,`select public.flexexa_claim_outbox_event(${q(s.tenant_id)},${q(s.environment)})`))),finish:async(s,lease,outcome)=>JSON.parse(await asyncSql(machineTx(publisherClaims,`select public.flexexa_finish_outbox_event(${q(s.tenant_id)},${q(s.environment)},${q(lease)},${q(outcome)})`)))};
 assert.equal(await deliverOutboxEvent(scope,db,{publishConfirmed:async message=>{assert.deepEqual(broker({operation:'publish',message}),{confirmed:true});}}),'published');
 const lost=broker({operation:'consume_policy_lost_ack',scope,claims:consumerClaims});
 assert.deepEqual(lost,{redelivered:false,consumer:{error:'SIMULATED_ACK_LOSS'}});
 assert.equal(sql(`select count(*) from public.inbox_events where tenant_id='${tenant}'`),'1');
 assert.deepEqual(broker({operation:'consume_policy',scope,claims:consumerClaims}),{redelivered:true,consumer:{status:'processed'}});
 assert.equal(broker({operation:'consume_policy',scope,claims:consumerClaims}),null);
 brokerRecovery=true;
}
let acknowledgements=0;
const consumed=await Promise.all(Array.from({length:16},()=>consumePolicyPublication(scope,event,inbox,{acknowledge:async()=>{acknowledgements++;}})));
assert.ok(consumed.every(x=>x==='processed'));assert.equal(acknowledgements,16);
assert.equal(sql(`select count(*) from public.inbox_events where tenant_id='${tenant}'`),'1');
assert.equal(sql(`select count(*) from public.audit_events where tenant_id='${tenant}' and action='policy_readiness_evaluated'`),'1');
assert.equal(sql(`select status from public.tenant_policy_readiness where tenant_id='${tenant}'`),'blocked');
// A newer publication for a different tenant must not invalidate this tenant.
const otherTenant=randomUUID();
sql(`insert into public.tenants(id,organization_id,name,slug) values('${otherTenant}','${org}','Other policy tenant','${otherTenant}')`);
const other=await invoke(1,'create',{...payload,tenants:[otherTenant]},'other-create');
const otherVersion={policy_set_version_id:other.policy_set_version_id};
await invoke(1,'test',otherVersion,'other-test');
await invoke(1,'shadow',{...otherVersion,observations},'other-shadow');
await invoke(2,'approve',otherVersion,'other-approve');
await invoke(2,'publish',otherVersion,'other-publish');
await invoke(2,'readiness',version,'original-readiness');
assert.equal(sql(`select status from public.tenant_policy_readiness where tenant_id='${tenant}' and policy_set_version_id='${version.policy_set_version_id}'`),'blocked');
assert.equal(sql(`select status from public.tenant_policy_readiness where tenant_id='${otherTenant}'`),'pending');
// A delayed first delivery of an obsolete version records superseded, never
// overwriting the fresh pending row for the newly published version.
const newerOther=await invoke(1,'create',{...payload,tenants:[otherTenant]},'other-new-create');
const newerOtherVersion={policy_set_version_id:newerOther.policy_set_version_id};
await invoke(1,'test',newerOtherVersion,'other-new-test');
await invoke(1,'shadow',{...newerOtherVersion,observations},'other-new-shadow');
await invoke(2,'approve',newerOtherVersion,'other-new-approve');
await invoke(2,'publish',newerOtherVersion,'other-new-publish');
sql(`insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json) select '${consumerService}','${otherTenant}',id,'{"environment":"sandbox"}' from public.permissions where permission_key='events.consume'`);
assert.equal(await consumePolicyPublication({tenant_id:otherTenant,environment:'sandbox'},captureEvent(otherVersion.policy_set_version_id,otherTenant),inbox,{acknowledge:async()=>{}}),'superseded');
assert.equal(sql(`select status from public.tenant_policy_readiness where tenant_id='${otherTenant}' and policy_set_version_id='${newerOtherVersion.policy_set_version_id}'`),'pending');
// Revocation by wall-clock expiry while an inbox duplicate waits on its event.
const inboxBlockerName='inbox-lock-'+randomUUID();
const inboxBlocker=asyncSql(`set application_name=${q(inboxBlockerName)};begin;select id from public.outbox_events where id='${event.event_id}' for update;select pg_sleep(3);commit;`);
let inboxLocked=false;
for(let attempt=0;attempt<100;attempt++){
 if(sql(`select count(*) from pg_stat_activity where application_name=${q(inboxBlockerName)} and wait_event='PgSleep'`)==='1'){inboxLocked=true;break;}
 await new Promise(resolve=>setTimeout(resolve,20));
}
assert.equal(inboxLocked,true);
sql(`update public.service_identity_tenant_grants set valid_until=clock_timestamp()+interval '1 second' where service_identity_id='${consumerService}' and tenant_id='${tenant}'`);
let expiredAck=0;
await assert.rejects(consumePolicyPublication(scope,event,inbox,{acknowledge:async()=>{expiredAck++;}}),/PERMISSION_DENIED/);
await inboxBlocker;assert.equal(expiredAck,0);
assert.equal(sql(`select count(*) from public.inbox_events where tenant_id='${tenant}'`),'1');
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
console.log(JSON.stringify({policyRegistry:{createRaces:16,publishRaces:16,kernelParity:observations.length,expiredSessionAfterRealLock:'denied',atomicEvidence:true,inboxRaces:16,brokerAckLossRecovery:brokerRecovery}}));
