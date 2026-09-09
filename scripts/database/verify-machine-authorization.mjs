import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ensureSourceWorkspace } from './source-workspace.mjs';
for (const [key,value] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'})) {
 if(process.env[key]!==value)throw Error('Refusing non-disposable machine authorization verification');
}
ensureSourceWorkspace();
const {machinePermissionRpc,parseMachinePermissionResult}=await import('../../packages/api-contracts/src/machine-authorization.ts');
const q=value=>"'"+value.replaceAll("'","''")+"'";
const sql=command=>execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-XAtq','--set=ON_ERROR_STOP=1','--command',command],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
const [actor,session,org,tenant,service,binding]=Array.from({length:6},()=>randomUUID());
sql(`insert into auth.users(id,email,is_anonymous) values('${actor}','machine-roundtrip-${actor}@example.invalid',false);
 insert into auth.sessions(id,user_id) values('${session}','${actor}');
 insert into public.organizations(id,name,slug) values('${org}','Machine verification','${org}');
 insert into public.tenants(id,organization_id,name,slug) values('${tenant}','${org}','Machine verification','${tenant}');
 insert into public.service_identities(id,service_key,name) values('${service}','machine-${service}','Machine verification');
 insert into public.service_identity_tenant_grants(service_identity_id,tenant_id,permission_id,scope_json)
  select '${service}','${tenant}',id,'{"environment":"sandbox"}' from public.permissions where permission_key='integrations.read';
 insert into private.flexexa_machine_principals(id,auth_user_id,principal_type,service_identity_id,environment)
  values('${binding}','${actor}','service','${service}','sandbox');`);
const scope={tenant_id:tenant,environment:'sandbox'};
const call=machinePermissionRpc({...scope,permission_key:'integrations.read'},scope);
assert.equal(call.function_name,'flexexa_machine_has_permission');
const claims=q(JSON.stringify({sub:actor,session_id:session,role:'authenticated'}));
const check=()=>parseMachinePermissionResult(JSON.parse(sql(`begin; set local role authenticated;
 set local request.jwt.claims=${claims};
 select to_jsonb(public.flexexa_machine_has_permission(${q(call.args.p_tenant_id)},${q(call.args.p_permission_key)},${q(call.args.p_environment)})); rollback;`)));
assert.equal(check(),true);
// Committed revocation followed by a new transaction using the SAME authenticated-session claim fixture.
sql(`delete from auth.sessions where id='${session}';`);
assert.equal(check(),false);
const facts=JSON.parse(sql(`select jsonb_build_object('audit',(select count(*) from public.audit_events where tenant_id='${tenant}'),
 'outbox',(select count(*) from public.outbox_events where tenant_id='${tenant}'));`));
assert.deepEqual(facts,{audit:0,outbox:0});
console.log(JSON.stringify({machine_rpc_round_trips:2,session_revocation_rechecked:true,scope:'sandbox',physical_commands_sent:0}));
