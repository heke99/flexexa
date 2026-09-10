import assert from 'node:assert/strict';
import test from 'node:test';
import {tenantId} from '../../domain/src/index.ts';
import {createFlexexaMutationApi} from '../src/rpc.ts';
const tenant=tenantId('ad100000-0000-4000-8000-000000000001'),other=tenantId('ad100000-0000-4000-8000-000000000002');
const id='ad100000-0000-4000-8000-000000000003',correlation='ad100000-0000-4000-8000-000000000004';
const cases=[
 ['createCustomer','flexexa_create_customer','customer',{customer_type:'person',display_name:'  Canonical  '},{customer_type:'person',display_name:'Canonical',external_customer_id:null}],
 ['createSite','flexexa_create_site','site',{customer_id:id,name:'Home'},{customer_id:id,name:'Home',external_site_id:null,country_code:'SE',timezone:'Europe/Stockholm'}],
 ['createMeteringPoint','flexexa_create_metering_point','metering_point',{site_id:id,external_metering_point_id:'meter'},{site_id:id,external_metering_point_id:'meter',metering_point_type:'consumption',measurement_resolution_minutes:15,market_area_id:null}],
 ['createAsset','flexexa_create_asset','asset',{customer_id:id,site_id:id,asset_type:'ev',display_name:'Car'},{customer_id:id,site_id:id,asset_type:'ev',display_name:'Car',external_id:null,manufacturer:null,model:null,rated_power_kw:null,energy_capacity_kwh:null}],
 ['registerProviderAccount','flexexa_register_provider_account','provider_account',{customer_id:id,provider_key:'ocpp',environment:'sandbox'}],
 ['revokeProviderAccount','flexexa_revoke_provider_account','provider_account',{provider_account_id:id,environment:'sandbox',reason_code:'security'}],
];
function input(payload){return {tenant_id:tenant,payload,idempotency_key:'original-key',correlation_id:correlation};}
function receipt(method,kind){return {tenant_id:tenant,resource_type:kind,resource_id:id,correlation_id:other,idempotency_key:'original-key',status:kind==='provider_account'?(method.startsWith('register')?'registered':'revoked'):'created',...(kind==='provider_account'?{environment:'sandbox'}:{})};}
for(const [method,rpc,kind,payload,normalized=payload] of cases){
 test(`${method} uses exact canonical database arguments and original receipt`,async()=>{
  let calls=0;const result=receipt(method,kind);
  const api=createFlexexaMutationApi({rpc:async(name,args)=>{
   calls++;assert.equal(name,rpc);assert.deepEqual(args,{p_tenant_id:tenant,p_payload:normalized,p_idempotency_key:'original-key',p_correlation_id:correlation});assert(Object.isFrozen(args));return {data:result,error:null};
  }},tenant);
  const actual=await api[method](input(payload));assert.deepEqual(actual,result);assert(Object.isFrozen(actual));assert.equal(calls,1);
 });
 test(`${method} rejects untrusted scope before transport`,async()=>{
  let calls=0;const api=createFlexexaMutationApi({rpc:async()=>{calls++;throw Error('must not call');}},tenant);
  await assert.rejects(api[method]({...input(payload),tenant_id:other}),{code:'TENANT_MISMATCH'});
  await assert.rejects(api[method](input({...payload,credential_reference:'not-allowed'})),{code:'VALIDATION_ERROR'});
  assert.equal(calls,0);
 });
 test(`${method} does not accept foreign or inflated receipt`,async()=>{
  for(const change of [{tenant_id:other},{status:'connected'},{idempotency_key:'other'},{token:'must-not-leak'}]){
   const api=createFlexexaMutationApi({rpc:async()=>({data:{...receipt(method,kind),...change},error:null})},tenant);
   await assert.rejects(api[method](input(payload)),{code:change.tenant_id?'TENANT_MISMATCH':'VALIDATION_ERROR'});
  }
 });
}
test('transport and database errors are sanitized, with no automatic retry',async()=>{
 const raw=input(cases[0][3]);
 for(const [error,code] of [[{code:'P0001',message:'IDEMPOTENCY_CONFLICT'},'IDEMPOTENCY_CONFLICT'],[{code:'42501',message:'private detail'},'PERMISSION_DENIED'],[{code:'23505',message:'private account identity'},'INTERNAL_ERROR'],[{code:'P0001',message:'secret detail'},'INTERNAL_ERROR']]){
  let calls=0;const api=createFlexexaMutationApi({rpc:async()=>{calls++;return {data:receipt('createCustomer','customer'),error};}},tenant);
  await assert.rejects(api.createCustomer(raw),e=>e.code===code&&e.message===code);assert.equal(calls,1);
 }
 let calls=0;const api=createFlexexaMutationApi({rpc:async()=>{calls++;throw Error('credentials in transport error');}},tenant);
 await assert.rejects(api.createCustomer(raw),e=>e.code==='INTERNAL_ERROR'&&!e.message.includes('credentials'));assert.equal(calls,1);
});
test('malformed transport data fails closed',async()=>{
 for(const data of [null,[],{},42]){
  const api=createFlexexaMutationApi({rpc:async()=>({data,error:null})},tenant);
  await assert.rejects(api.createCustomer(input(cases[0][3])));
 }
});
