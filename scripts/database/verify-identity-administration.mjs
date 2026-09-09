import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { ensureSourceWorkspace } from './source-workspace.mjs';
for(const [key,value] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'})) {
 if(process.env[key]!==value) throw Error('Refusing non-disposable identity administration verification');
}
ensureSourceWorkspace();
const {identityAdministrationRpc,parseIdentityAdministrationReceipt}=await import('../../packages/api-contracts/src/identity-administration.ts');
const q=v=>"'"+v.replaceAll("'","''")+"'";
const args=['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-XAtq','--set=ON_ERROR_STOP=1','--command'];
const opts={encoding:'utf8',timeout:30000,maxBuffer:1024*1024};
const sql=text=>execFileSync('psql',[...args,text],opts).trim();
const asyncSql=promisify(execFile);
const [actor,session,org,tenant,member,client,...targets]=Array.from({length:10},()=>randomUUID());
const marker=JSON.stringify({flexexa_machine_enrollment:{version:1,tenant_id:tenant,api_client_id:client,environment:'sandbox'}});
sql(`insert into auth.users(id,email,is_anonymous) values('${actor}','identity-admin-${actor}@example.invalid',false);
 insert into auth.sessions(id,user_id) values('${session}','${actor}');
 insert into public.organizations(id,name,slug) values('${org}','Identity concurrency','${org}');
 insert into public.tenants(id,organization_id,name,slug) values('${tenant}','${org}','Identity concurrency','${tenant}');
 insert into public.memberships(id,tenant_id,user_id) values('${member}','${tenant}','${actor}');
 insert into public.membership_roles(tenant_id,membership_id,role_id) select '${tenant}','${member}',id from public.roles where tenant_id='${tenant}' and role_key='tenant_admin';
 insert into public.api_clients(id,tenant_id,client_id,name,expires_at) values('${client}','${tenant}','${client}','Test client',now()+interval '1 hour');
 insert into public.api_client_permissions(tenant_id,api_client_id,permission_id,condition_json)
  select '${tenant}','${client}',id,'{"environment":"sandbox"}' from public.permissions where permission_key='integrations.read';
 ${targets.map(t=>`insert into auth.users(id,email,is_anonymous,raw_app_meta_data) values('${t}','enrollment-${t}@example.invalid',false,${q(marker)}::jsonb);`).join('\n')}`);
const claims=q(JSON.stringify({sub:actor,session_id:session,role:'authenticated',aal:'aal2'}));
const scope={tenant_id:tenant,environment:'sandbox'};
const enroll=target=>({api_client_id:client,auth_user_id:target,environment:'sandbox'});
const revoke=principal=>({principal_id:principal,environment:'sandbox',reason_code:'rotation'});
let calls=0;
async function race(kind,payloads,keys) {
 return Promise.all(payloads.map(async(payload,index)=>{
  const request={tenant_id:tenant,payload,idempotency_key:keys[index],correlation_id:randomUUID()};
  const call=identityAdministrationRpc(kind,request,scope), a=call.args;
  assert(['flexexa_enroll_api_client_identity','flexexa_revoke_api_client_identity'].includes(call.function_name));
  calls++;
  let output;
  try {
   output=await asyncSql('psql',[...args,`begin; set local statement_timeout='25s'; set local role authenticated;
    set local request.jwt.claims=${claims};
    select public.${call.function_name}(${q(a.p_tenant_id)},${q(JSON.stringify(a.p_payload))}::jsonb,${q(a.p_idempotency_key)},${q(a.p_correlation_id)});
    select pg_sleep(0.05); commit;`],opts);
  } catch(error) {return {error:String(error.stderr??'execution failure')};}
  return {receipt:parseIdentityAdministrationReceipt(JSON.parse(output.stdout.trim()),call)};
 }));
}
function check(results,winners,errorCode) {
 const good=results.filter(x=>x.receipt),bad=results.filter(x=>x.error);
 assert.equal(good.length,winners,JSON.stringify(results));
 assert(bad.every(x=>errorCode && x.error.includes(errorCode)),JSON.stringify(results));
 assert(good.length>0);
 for(const x of good) assert.deepEqual(x.receipt,good[0].receipt);
 return good[0].receipt;
}
const first=check(await race('enroll',Array(8).fill(enroll(targets[0])),Array(8).fill('enroll-same')),8);
const second=check(await race('enroll',Array(8).fill(enroll(targets[1])),Array.from({length:8},(_,i)=>`distinct-${i}`)),1,'INVALID_STATE_TRANSITION');
check(await race('enroll',Array.from({length:8},(_,i)=>enroll(targets[2+i%2])),Array(8).fill('enroll-conflict')),4,'IDEMPOTENCY_CONFLICT');
const machineSession=randomUUID();
sql(`insert into auth.sessions(id,user_id) values('${machineSession}','${targets[0]}');`);
const machineClaims=q(JSON.stringify({sub:targets[0],session_id:machineSession,role:'authenticated'}));
const preflight=()=>JSON.parse(sql(`begin;set local role authenticated;set local request.jwt.claims=${machineClaims};
 select to_jsonb(public.flexexa_machine_has_permission('${tenant}','integrations.read','sandbox'));rollback;`));
assert.equal(preflight(),true);
check(await race('revoke',Array(8).fill(revoke(first.resource_id)),Array(8).fill('revoke-same')),8);
assert.equal(preflight(),false);
check(await race('revoke',Array(8).fill(revoke(second.resource_id)),Array.from({length:8},(_,i)=>`revoke-${i}`)),1,'INVALID_STATE_TRANSITION');
const facts=JSON.parse(sql(`select jsonb_build_object(
 'principals',(select count(*) from private.flexexa_machine_principals where tenant_id='${tenant}'),
 'revoked',(select count(*) from private.flexexa_machine_principals where tenant_id='${tenant}' and status='revoked'),
 'receipts',(select count(*) from public.idempotency_records where tenant_id='${tenant}' and status='completed'),
 'unfinished',(select count(*) from public.idempotency_records where tenant_id='${tenant}' and status<>'completed'),
 'audits',(select count(*) from public.audit_events where tenant_id='${tenant}'),
 'outbox',(select count(*) from public.outbox_events where tenant_id='${tenant}'),
 'grants',(select count(*) from public.api_client_permissions where tenant_id='${tenant}'));`));
assert.deepEqual(facts,{principals:3,revoked:2,receipts:5,unfinished:0,audits:5,outbox:5,grants:1});
assert.equal(calls,40);
console.log(JSON.stringify({identity_administration_concurrent_calls:calls,canonical_receipt_parity:true,same_session_revocation_rechecked:true,facts,physical_commands_sent:0}));
