import test from 'node:test';
import assert from 'node:assert/strict';
import {createReservedAuthAdmin,createCallerRpc} from '../src/supabase.ts';
const id=n=>'ce400000-0000-4000-8000-'+String(n).padStart(12,'0');
const identity={tenant_id:id(1),api_client_id:id(2),intended_auth_user_id:id(3),environment:'sandbox'};
const marker={version:1,tenant_id:id(1),api_client_id:id(2),environment:'sandbox'};
const user=()=>({id:id(3),is_anonymous:false,app_metadata:{flexexa_machine_enrollment:{...marker}}});
const key='TEST_ONLY_ADMIN_CREDENTIAL';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
function fixture(responder){const calls=[];const api=createReservedAuthAdmin({url:'https://example.supabase.co',fetcher:async(url,init)=>{calls.push({url,...init});return responder(url,init);}},key);return {api,calls};}
test('only precise user-not-found response permits creation',async()=>{
 const f=fixture(()=>json({error_code:'user_not_found'},404));assert.equal(await f.api.find(identity),false);
 const bad=fixture(()=>json({error_code:'route_not_found'},404));await assert.rejects(()=>bad.api.find(identity),e=>e.code==='INTERNAL_ERROR');
});
test('create uses exact reserved UUID and server marker, returns no password',async()=>{
 const f=fixture(()=>json(user()));assert.equal(await f.api.create(identity),undefined);
 const p=JSON.parse(f.calls[0].body);assert.equal(p.id,id(3));assert.deepEqual(p.app_metadata,{flexexa_machine_enrollment:marker});
 assert.equal(p.password.length,43);assert.equal(p.email,id(3)+'@machine.flexexa.invalid');assert.equal(p.email_confirm,true);
 assert.equal(f.calls[0].redirect,'error');assert.equal(f.calls[0].headers.Authorization,'Bearer '+key);
});
for(const [name,change] of [['identity',u=>u.id=id(9)],['tenant',u=>u.app_metadata.flexexa_machine_enrollment.tenant_id=id(9)],
 ['client',u=>u.app_metadata.flexexa_machine_enrollment.api_client_id=id(9)],['environment',u=>u.app_metadata.flexexa_machine_enrollment.environment='production'],
 ['anonymous',u=>u.is_anonymous=true],['extra marker',u=>u.app_metadata.flexexa_machine_enrollment.extra=true]])test(`Auth response rejects wrong ${name}`,async()=>{
 const u=user();change(u);const f=fixture(()=>json(u));await assert.rejects(()=>f.api.find(identity));assert.equal(f.calls.length,1);
});
test('upstream diagnostics are sanitized',async()=>{
 const f=fixture(()=>{throw Error(key);});await assert.rejects(()=>f.api.create(identity),e=>e.code==='INTERNAL_ERROR'&&!String(e).includes(key));
});
test('oversized response is rejected',async()=>{
 const f=fixture(()=>json({padding:'x'.repeat(65537)}));await assert.rejects(()=>f.api.find(identity),e=>e.code==='INTERNAL_ERROR');
});
for(const url of ['http://example.com','https://user:password@example.com','https://example.com/?key=x','https://example.com/auth'])test(`invalid service URL rejected: ${url}`,()=>{
 assert.throws(()=>createReservedAuthAdmin({url},key));
});
test('caller RPC uses caller JWT and refuses generic RPC dispatch',async()=>{
 const calls=[];const rpc=createCallerRpc({url:'https://example.supabase.co',fetcher:async(url,init)=>{calls.push({url,...init});return json({code:'42501'},403);}},'TEST_PUBLISHABLE_KEY','TEST_CALLER_JWT');
 await assert.rejects(()=>rpc.rpc('arbitrary',{}));assert.equal(calls.length,0);
 assert.deepEqual(await rpc.rpc('flexexa_check_identity_execution_lease',{}),{data:null,error:{code:'42501'}});
 assert.equal(calls[0].headers.Authorization,'Bearer TEST_CALLER_JWT');assert.equal(calls[0].headers.apikey,'TEST_PUBLISHABLE_KEY');
});
