import assert from 'node:assert/strict';
import {test} from 'node:test';

const db='https://project.example.test';
const service='fixture-service-role';
const actor='fab8710c-bfbb-4b9d-93db-5d8fe07aa66e';
const bearer='Bearer header.payload.signature';
const secret='f'.repeat(64);
globalThis.Deno={env:{get:name=>({SUPABASE_URL:db,SUPABASE_SERVICE_ROLE_KEY:service})[name]},serve:()=>{}};
const {handleApplications}=await import('../supabase/functions/flexexa-applications/index.ts');

function request(action, authorization, data={}) {
 return new Request(db+'/functions/v1/flexexa-applications',{
  method:'POST', headers:authorization?{Authorization:authorization}:{},
  body:JSON.stringify({action,secret,data,actor:'untrusted'}),
 });
}

test('gateway validates the administrator before sending service-scoped data to the database', async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  calls.push({url,...options});
  return Response.json(url.endsWith('/auth/v1/user')?{id:actor}:{ok:true});
 });
 assert.equal((await handleApplications(request('admin_list',bearer,{page:0}))).status,200);
 assert.deepEqual(calls.map(c=>c.url),[db+'/auth/v1/user',db+'/rest/v1/rpc/flexexa_applications_admin']);
 assert.equal(calls[0].headers.Authorization,bearer);
 assert.equal(calls[1].headers.Authorization,'Bearer '+service);
 assert.deepEqual(JSON.parse(calls[1].body),{p_action:'admin_list',p_secret:secret,p_data:{page:0},p_actor:actor});
});

test('gateway restricts actions and keeps rejected administrator tokens out of the database', async t=>{
 const calls=[];
 t.mock.method(globalThis,'fetch',async url=>{
  calls.push(url);
  return Response.json({}, {status:401});
 });
 assert.equal((await handleApplications(request('owner_auth',bearer))).status,400);
 assert.equal((await handleApplications(request('admin_list'))).status,401);
 assert.equal((await handleApplications(request('admin_list',bearer))).status,401);
 assert.deepEqual(calls,[db+'/auth/v1/user']);
});

test('public totals remain service scoped and access-token context is ignored', async t=>{
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,db+'/rest/v1/rpc/flexexa_applications');
  assert.equal(options.headers.Authorization,'Bearer '+service);
  assert.deepEqual(JSON.parse(options.body),{p_action:'stats',p_secret:secret,p_data:{}});
  return Response.json({count:93,remaining:907});
 });
 const response=await handleApplications(request('stats',bearer));
 assert.equal(response.status,200);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.deepEqual(await response.json(),{count:93,remaining:907});
});

test('gateway preserves retry seconds on 429 without exposing the upstream response', async t=>{
 let retry = '25';
 t.mock.method(globalThis,'fetch',async()=>Response.json({internal:'fixture'}, {
  status:429, headers:{'Retry-After':retry},
 }));
 const response=await handleApplications(request('stats'));
 assert.equal(response.status,429);
 assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal(response.headers.get('Retry-After'),'25');
 assert.deepEqual(await response.json(),{error:'RATE_LIMITED'});
 retry='99999';
 assert.equal((await handleApplications(request('stats'))).headers.get('Retry-After'),null);
});
