import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ensureSourceWorkspace } from './source-workspace.mjs';
for(const [k,v] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'}))if(process.env[k]!==v)throw Error('Refusing non-disposable outbox verification');
ensureSourceWorkspace();
const { deliverOutboxEvent }=await import('../../packages/events/src/outbox-delivery.ts');
const args=['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-XAtq','--set=ON_ERROR_STOP=1'];
const q=x=>"'"+String(x).replaceAll("'","''")+"'";
const sql=s=>execFileSync('psql',[...args,'--command',s],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
const asyncSql=async s=>(await promisify(execFile)('psql',[...args,'--command',s],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024})).stdout.trim();
const [actor,session,org,tenant,service,binding,eventId,receipt,audit]=Array.from({length:9},()=>randomUUID());
const claims=q(JSON.stringify({sub:actor,session_id:session,role:'authenticated',aal:'aal1'}));
const transaction=s=>`begin;set local role authenticated;set local request.jwt.claims=${claims};${s};commit;`;
const call=(fn,values)=>`select to_jsonb(public.${fn}(${values.map(q).join(',')}))`;
sql(`insert into auth.users(id,is_anonymous) values('${actor}',false);insert into auth.sessions(id,user_id) values('${session}','${actor}');
insert into public.organizations(id,name,slug) values('${org}','Outbox integration','${org}');
insert into public.tenants(id,organization_id,name,slug) values('${tenant}','${org}','Outbox integration','${tenant}');
insert into public.service_identities(id,service_key,name) values('${service}','outbox-${service}','Outbox integration');
insert into private.flexexa_machine_principals(id,auth_user_id,principal_type,service_identity_id,environment) values('${binding}','${actor}','service','${service}','sandbox');
insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json) select '${service}','${tenant}',id,'{"environment":"sandbox"}' from public.permissions where permission_key='events.publish';
insert into public.idempotency_records(id,tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id) values('${receipt}','${tenant}','service','${service}','fixture','fixture',repeat('a',64),'${audit}');
insert into public.audit_events(id,tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id) values('${audit}','${tenant}','service','${service}','fixture','fixture','${eventId}','${audit}','${receipt}');
insert into public.outbox_events(id,tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json) values('${eventId}','${tenant}','${org}','${audit}','flexexa.fixture.created','${audit}','flexexa.fixture','{"environment":"sandbox"}');`);
const scope={tenant_id:tenant,environment:'sandbox'};
const database={claim:async()=>JSON.parse(await asyncSql(transaction(call('flexexa_claim_outbox_event',[tenant,'sandbox'])))),finish:async(s,id,outcome)=>JSON.parse(await asyncSql(transaction(call('flexexa_finish_outbox_event',[tenant,'sandbox',id,outcome]))))};
const claimsResult=await Promise.all(Array.from({length:16},()=>database.claim(scope)));
const winners=claimsResult.filter(Boolean);assert.equal(winners.length,1);assert.equal(winners[0].event.event_id,eventId);
const result=await Promise.all(Array.from({length:16},()=>database.finish(scope,winners[0].lease_id,'published')));
assert.ok(result.every(r=>r.status==='published'));
assert.equal(sql(`select count(*) from private.flexexa_outbox_delivery_results where tenant_id='${tenant}'`),'1');
let realBroker=false;
if(process.env.FLEXEXA_OUTBOX_BROKER_TEST==='1'){
 const broker=request=>JSON.parse(execFileSync(process.env.FLEXEXA_TEST_PYTHON,['scripts/runtime/rabbitmq/outbox-bridge.py'],{input:JSON.stringify(request),encoding:'utf8',timeout:20000,maxBuffer:1024*1024}));
 const second=randomUUID(),secondReceipt=randomUUID(),secondAudit=randomUUID();
 sql(`insert into public.idempotency_records(id,tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id) values('${secondReceipt}','${tenant}','service','${service}','fixture','second',repeat('b',64),'${secondAudit}');
 insert into public.audit_events(id,tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id) values('${secondAudit}','${tenant}','service','${service}','fixture','fixture','${second}','${secondAudit}','${secondReceipt}');
 insert into public.outbox_events(id,tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json) values('${second}','${tenant}','${org}','${secondAudit}','flexexa.fixture.created','${secondAudit}','flexexa.fixture','{"environment":"sandbox"}');`);
 const publisher={publishConfirmed:async message=>{assert.deepEqual(broker({operation:'publish',message}),{confirmed:true});}};
 // Real broker confirmation followed by a deliberately lost database response.
 let savedLease;
 const lostResponse={...database,claim:async s=>{const c=await database.claim(s);savedLease=c.lease_id;return c;},finish:async()=>{throw Error('SIMULATED_LOST_REQUEST');}};
 await assert.rejects(deliverOutboxEvent(scope,lostResponse,publisher),/SIMULATED_LOST_REQUEST/);
 assert.equal(sql(`select status from public.outbox_events where id='${second}'`),'pending');
 const received=broker({operation:'consume'});assert.equal(received.event_id,second);
 // Recovery before lease expiry repeats only the database acknowledgement.
 assert.equal((await database.finish(scope,savedLease,'published')).status,'published');
 assert.equal(broker({operation:'consume'}),null);
 realBroker=true;
}
// Revoking the same session affects every subsequent call, including receipt replay.
sql(`delete from auth.sessions where id='${session}'`);
await assert.rejects(database.finish(scope,winners[0].lease_id,'published'),/PERMISSION_DENIED/);
console.log(JSON.stringify({outbox_parallel_claims:16,exclusive_winners:1,idempotent_parallel_confirmations:16,session_revocation_rechecked:true,real_broker_confirmation:realBroker}));
