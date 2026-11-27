import {test} from 'node:test';
import {registerHooks} from 'node:module';
import assert from 'node:assert/strict';

const hooks=registerHooks({resolve(specifier,context,next){return specifier==='server-only'?{shortCircuit:true,url:'data:text/javascript,export%20{}'}:next(specifier,context);}});
const {sendPendingEmails,rpc,adminRpc,networkHash,reportApplicationFailure}=await import('../src/domains/applications/server.ts');
hooks.deregister();

function setup(t,statuses){
 for(const [name,value] of Object.entries({FLEXEXA_SUPABASE_URL:'https://db.example.test',FLEXEXA_SUPABASE_KEY:'fixture',FLEXEXA_WAITLIST_SECRET:'fixture',RESEND_API_KEY:'fixture'})){
  const previous=process.env[name];process.env[name]=value;
  t.after(()=>{if(previous===undefined)delete process.env[name];else process.env[name]=previous;});
 }
 let claimed=0;
 const outcomes=[];
 t.mock.method(globalThis,'fetch',async(url,{body})=>{
  if(url==='https://api.resend.com/emails'){
   const status=statuses[claimed-1];
   return Response.json(status===200?{id:'provider-job-'+claimed}:{},{status});
  }
  const input=JSON.parse(body);
  if(input.action==='claim_email')return Response.json(claimed<statuses.length?{id:String(++claimed),claim_token:'claim-'+claimed,payload:{}}:null);
  assert.equal(input.action,'finish_email');outcomes.push(input.data.outcome);
  return Response.json({updated:1});
 });
 return outcomes;
}

test('permanent email failure does not stop a later job in the same batch',async t=>{
 const outcomes=setup(t,[422,200]);
 assert.equal(await sendPendingEmails(2),1);
 assert.deepEqual(outcomes,['permanent','sent']);
});

test('retryable email failure stops the current batch rather than retrying in a loop',async t=>{
 const outcomes=setup(t,[429,200]);
 await assert.rejects(sendPendingEmails(2), { code: 'EMAIL_HTTP_429', status: 429 });
 assert.deepEqual(outcomes,['retry']);
});

test('an accepted email whose response was lost is reconciled with the same provider key', async t => {
 setup(t, []);
 const completions = [];
 const accepted = new Map();
 let attempt = 0;
 t.mock.method(globalThis, 'fetch', async (url, options) => {
  if (url === 'https://api.resend.com/emails') {
   const key = options.headers['Idempotency-Key'];
   assert.equal(key, 'flexexa-application-job-1');
   if (!accepted.has(key)) {
    accepted.set(key, { id: 'provider-1', body: options.body });
    throw new Error('fixture dropped response after provider acceptance');
   }
   assert.equal(options.body, accepted.get(key).body);
   return Response.json({ id: accepted.get(key).id });
  }
  const { action, data } = JSON.parse(options.body);
  if (action === 'claim_email') {
   attempt++;
   return Response.json({ id: 'job-1', claim_token: `claim-${attempt}`, payload: { to: ['queue@example.invalid'] } });
  }
  assert.equal(action, 'finish_email');
  completions.push(data);
  return Response.json({ updated: 1 });
 });
 await assert.rejects(sendPendingEmails(1), { code: 'TRANSPORT_UNCERTAIN', status: 503 });
 assert.equal(await sendPendingEmails(1), 1);
 assert.equal(accepted.size, 1);
 assert.deepEqual(completions, [
  { id: 'job-1', claim_token: 'claim-1', outcome: 'retry', error: 'TRANSPORT_UNCERTAIN' },
  { id: 'job-1', claim_token: 'claim-2', outcome: 'sent', error: '', provider_id: 'provider-1' },
 ]);
});

test('empty provider receipts and stale or invalid database confirmations cannot count as sent', async t => {
 setup(t, []);
 const completions = [];
 let receipt = { id: '' };
 let confirmation = { updated: 1 };
 t.mock.method(globalThis, 'fetch', async (url, options) => {
  if (url === 'https://api.resend.com/emails') return Response.json(receipt);
  const { action, data } = JSON.parse(options.body);
  if (action === 'claim_email') return Response.json({ id: 'job-1', claim_token: 'claim-1', payload: {} });
  assert.equal(action, 'finish_email');
  completions.push(data);
  return Response.json(confirmation);
 });
 await assert.rejects(sendPendingEmails(1), { code: 'INVALID_EMAIL_RECEIPT', status: 502 });
 assert.deepEqual(completions[0], { id: 'job-1', claim_token: 'claim-1', outcome: 'retry', error: 'INVALID_EMAIL_RECEIPT' });
 receipt = { id: 'provider-1' };
 confirmation = { updated: 0 };
 assert.equal(await sendPendingEmails(1), 0);
 confirmation = {};
 await assert.rejects(sendPendingEmails(1), { code: 'INVALID_EMAIL_COMPLETION', status: 502 });
});

test('application requests use the scoped gateway and only admin calls forward a user token', async t => {
 setup(t, []);
 const userToken = 'header.payload.signature';
 const seen = [];
 t.mock.method(globalThis, 'fetch', async (url, options) => {
  seen.push({ url, ...options });
  return Response.json({ ok: true });
 });
 await rpc('stats');
 await adminRpc('admin_list', userToken, { page: 1 });
 assert.ok(seen.every(call => new URL(call.url).pathname === '/functions/v1/flexexa-applications'));
 assert.ok(seen.every(call => call.headers.apikey === 'fixture'));
 assert.equal(seen[0].headers.Authorization, undefined);
 assert.equal(seen[1].headers.Authorization, 'Bearer ' + userToken);
 assert.deepEqual(JSON.parse(seen[1].body), { action: 'admin_list', secret: 'fixture', data: { page: 1 } });
});

test('local input rejects malformed tokens and the gateway preserves authentication and rate outcomes', async t => {
 setup(t, []);
 let hits = 0;
 t.mock.method(globalThis, 'fetch', async (_url, options) => {
  hits++;
  return options.headers.Authorization ? Response.json({}, { status: 401 }) :
    Response.json({}, { status: 429, headers: { 'Retry-After': '30' } });
 });
 await assert.rejects(adminRpc('admin_list', 'bad token'), { code: 'UNAUTHENTICATED', status: 401 });
 assert.equal(hits, 0);
 await assert.rejects(adminRpc('admin_list', 'header.payload.signature'), { code: 'UNAUTHENTICATED', status: 401 });
 await assert.rejects(rpc('stats'), error => {
  assert.equal(error.code, 'RATE_LIMITED');
  assert.equal(error.status, 429);
  const { headers } = reportApplicationFailure('stats', error);
  assert.equal(headers.get('Cache-Control'), 'no-store');
  assert.equal(headers.get('Retry-After'), '30');
  return true;
 });
});

test('network budget ignores generic forwarding headers and uses only a single trusted IP', t => {
 setup(t, []);
 const original = process.env.VERCEL;
 t.after(() => { if (original === undefined) delete process.env.VERCEL; else process.env.VERCEL = original; });
 const request = headers => new Request('https://app.example.test', { headers });
 delete process.env.VERCEL;
 const conservative = networkHash(request({}));
 assert.equal(networkHash(request({ 'x-vercel-forwarded-for': '192.0.2.1' })), conservative);
 process.env.VERCEL = '1';
 assert.equal(networkHash(request({ 'x-forwarded-for': '192.0.2.1' })), conservative);
 assert.equal(networkHash(request({ 'x-vercel-forwarded-for': '192.0.2.1, 192.0.2.2' })), conservative);
 assert.notEqual(networkHash(request({ 'x-vercel-forwarded-for': '192.0.2.1' })), conservative);
});
