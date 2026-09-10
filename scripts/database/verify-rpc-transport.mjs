import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ensureSourceWorkspace } from './source-workspace.mjs';

// This is a test bridge to disposable PostgreSQL, NOT an application transport.
for(const [key,value] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'})){
  if(process.env[key]!==value)throw Error('Refusing non-disposable RPC transport verification');
}
ensureSourceWorkspace();
const {tenantId}=await import('../../packages/domain/src/index.ts');
const {createFlexexaMutationApi}=await import('../../packages/api-contracts/src/rpc.ts');
const literal=value=>"'"+value.replaceAll("'","''")+"'";
function sql(command){
  return execFileSync('psql',['-h','127.0.0.1','-p','54322','-U','postgres','-d','postgres','-XAtq','--set=ON_ERROR_STOP=1','--command',command],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
}
const [actor,org,tenant,member]=Array.from({length:4},()=>randomUUID());
sql(`insert into auth.users(id,email) values('${actor}','transport-${actor}@example.invalid');
 insert into public.organizations(id,name,slug) values('${org}','Disposable transport','${org}');
 insert into public.tenants(id,organization_id,name,slug) values('${tenant}','${org}','Disposable transport','${tenant}');
 insert into public.memberships(id,tenant_id,user_id) values('${member}','${tenant}','${actor}');
 insert into public.membership_roles(tenant_id,membership_id,role_id) select '${tenant}','${member}',id from public.roles where tenant_id='${tenant}' and role_key='tenant_admin';`);
const allowed=new Set(['flexexa_create_customer','flexexa_create_site','flexexa_create_metering_point','flexexa_create_asset','flexexa_register_provider_account','flexexa_revoke_provider_account']);
const invoked=new Set();let calls=0;
const claims=literal(JSON.stringify({sub:actor,role:'authenticated',aal:'aal1'}));
const api=createFlexexaMutationApi({async rpc(name,args){
  assert(allowed.has(name));invoked.add(name);calls++;
  const output=sql(`begin; set local statement_timeout='25s'; set local role authenticated; set local request.jwt.claims=${claims};
   select public.${name}(${literal(args.p_tenant_id)},${literal(JSON.stringify(args.p_payload))}::jsonb,${literal(args.p_idempotency_key)},${literal(args.p_correlation_id)}); commit;`);
  return {data:JSON.parse(output),error:null};
}},tenantId(tenant));
const request=payload=>({tenant_id:tenant,payload,idempotency_key:'transport-key',correlation_id:randomUUID()});
const customerPayload={customer_type:'person',display_name:'  Canonical transport  '};
const customer=await api.createCustomer(request(customerPayload));
assert.deepEqual(await api.createCustomer(request(customerPayload)),customer);
const site=await api.createSite(request({customer_id:customer.resource_id,name:'Home'}));
await api.createMeteringPoint(request({site_id:site.resource_id,external_metering_point_id:`fixture-${tenant}`}));
const asset=await api.createAsset(request({customer_id:customer.resource_id,site_id:site.resource_id,asset_type:'ev',display_name:'Car'}));
const accountPayload={customer_id:customer.resource_id,provider_key:'ocpp',environment:'sandbox'};
const account=await api.registerProviderAccount(request(accountPayload));
assert.deepEqual(await api.registerProviderAccount(request(accountPayload)),account);
const revoked=await api.revokeProviderAccount(request({provider_account_id:account.resource_id,environment:'sandbox',reason_code:'administrative'}));
assert.equal(revoked.resource_id,account.resource_id);assert.equal(revoked.status,'revoked');
assert.equal(calls,8);assert.equal(invoked.size,6);
const counts=JSON.parse(sql(`select jsonb_build_object(
 'receipts',(select count(*) from public.idempotency_records where tenant_id='${tenant}'),
 'audits',(select count(*) from public.audit_events where tenant_id='${tenant}'),
 'outbox',(select count(*) from public.outbox_events where tenant_id='${tenant}'),
 'controllable',(select controllable from public.assets where id='${asset.resource_id}'),
 'account_status',(select connection_status from public.provider_accounts where id='${account.resource_id}'));`));
assert.deepEqual(counts,{receipts:6,audits:6,outbox:6,controllable:false,account_status:'revoked'});
console.log(JSON.stringify({canonical_transport_calls:calls,actual_database_functions:invoked.size,replays_preserve_original_receipts:true,counts,physical_commands_sent:0}));
