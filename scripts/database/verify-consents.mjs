import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {execFileSync, spawn} from 'node:child_process';
import {ensureSourceWorkspace} from './source-workspace.mjs';
import {cases, grant as grantFixture} from '../../packages/api-contracts/test/fixtures/consents.mjs';
for (const [key, value] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1', PGHOST:'127.0.0.1', PGPORT:'54322', PGUSER:'postgres', PGDATABASE:'postgres'})) {
  assert.equal(process.env[key], value, 'Refusing non-disposable consent verification');
}
ensureSourceWorkspace();
const {tenantId} = await import('../../packages/domain/src/index.ts');
const {createFlexexaConsentApi} = await import('../../packages/api-contracts/src/consents.ts');
const literal = value => "'" + value.replaceAll("'", "''") + "'";
const json = value => literal(JSON.stringify(value)) + '::jsonb';
const args = ['-XAtq', '--set=ON_ERROR_STOP=1', '--set=VERBOSITY=terse'];
function sql(command) {
  return execFileSync('psql', [...args, '--command', command], {encoding:'utf8', timeout:30000, maxBuffer:1024*1024, stdio:['ignore','pipe','pipe']}).trim();
}
function query(command) {
  return new Promise((resolve, reject) => {
    const child = spawn('psql', [...args, '--command', command], {stdio:['ignore','pipe','pipe']});
    let out = '', err = '';
    const timer = setTimeout(() => {child.kill('SIGKILL'); reject(Error('Consent query timed out'));}, 35000);
    child.stdout.on('data', value => {out += value;});
    child.stderr.on('data', value => {err += value;});
    child.on('error', reject);
    child.on('close', code => {clearTimeout(timer); resolve({code, out:out.trim(), err});});
  });
}
assert.ok(cases.length >= 150);
for (const c of cases) {
  const result = await query(`select private.flexexa_normalize_consent_input(${literal(c.kind)},${json(c.input)});`);
  if (c.error) {assert.notEqual(result.code, 0, c.name); assert.ok(result.err.includes(c.error), c.name);}
  else {assert.equal(result.code, 0, c.name); assert.deepEqual(JSON.parse(result.out), c.expected, c.name);}
}
const [actor, org, tenant, member, customer, site, asset] = Array.from({length:7}, () => randomUUID());
sql(`insert into auth.users(id,email) values('${actor}','consents-${actor}@example.invalid');
 insert into public.organizations(id,name,slug) values('${org}','Disposable consents','${org}');
 insert into public.tenants(id,organization_id,name,slug) values('${tenant}','${org}','Disposable consents','${tenant}');
 insert into public.memberships(id,tenant_id,user_id) values('${member}','${tenant}','${actor}');
 insert into public.membership_roles(tenant_id,membership_id,role_id) select '${tenant}','${member}',id from public.roles where tenant_id='${tenant}' and role_key='tenant_admin';
 insert into public.customers(id,tenant_id,customer_type,display_name) values('${customer}','${tenant}','person','Disposable');
 insert into public.sites(id,tenant_id,customer_id,name) values('${site}','${tenant}','${customer}','Disposable');
 insert into public.assets(id,tenant_id,customer_id,site_id,asset_type,display_name) values('${asset}','${tenant}','${customer}','${site}','ev','Disposable');`);
const claims = literal(JSON.stringify({sub:actor, role:'authenticated', aal:'aal2'}));
const begin = `begin; set local statement_timeout='25s'; set local role authenticated; set local request.jwt.claims=${claims};`;
const grant = {...grantFixture, customer_id:customer, site_id:site, asset_id:asset};
function rpc(name, payload, key = 'default') {
  assert.ok(['grant', 'revoke', 'check'].includes(name));
  return `select public.flexexa_${name}_consent('${tenant}',${json(payload)}${name === 'check' ? '' : `,${literal(key)},'${randomUUID()}'`});`;
}
const api = createFlexexaConsentApi({async rpc(name, a) {
  assert.ok(['flexexa_grant_consent','flexexa_revoke_consent','flexexa_check_consent'].includes(name));
  const result = await query(`${begin} select public.${name}(${literal(a.p_tenant_id)},${json(a.p_payload)}${a.p_idempotency_key === undefined ? '' : `,${literal(a.p_idempotency_key)},${literal(a.p_correlation_id)}`}); commit;`);
  if (result.code) throw Error('Isolated typed consent RPC failed');
  return {data:JSON.parse(result.out), error:null};
}}, tenantId(tenant));
const request = (payload, key) => ({tenant_id:tenant, payload, idempotency_key:key, correlation_id:randomUUID()});
const typed = await api.grantConsent(request({...grant, consent_type:'smart_charging'}, 'typed'));
assert.deepEqual(await api.grantConsent(request({...grant, consent_type:'smart_charging'}, 'typed')), typed);
const pinned = receipt => ({consent_id:receipt.resource_id, customer_id:customer, site_id:site, asset_id:asset, environment:'sandbox', consent_type:'remote_control', policy_version:grant.policy_version});
assert.equal((await api.checkConsent({...pinned(typed), consent_type:'smart_charging'})).valid, true);
await api.revokeConsent(request({consent_id:typed.resource_id, environment:'sandbox', reason_code:'security'}, 'typed-revoke'));
assert.equal((await api.checkConsent({...pinned(typed), consent_type:'smart_charging'})).valid, false);
let concurrentCalls = 0;
async function race(kind, payloads, keys) {
  concurrentCalls += keys.length;
  return Promise.all(keys.map((key, i) => query(`${begin} ${rpc(kind, payloads[i], key)} select pg_sleep(0.05); commit;`)));
}
function winners(results, count, error) {
  const good = results.filter(r => r.code === 0).map(r => JSON.parse(r.out));
  const bad = results.filter(r => r.code !== 0);
  assert.equal(good.length, count);
  for (const r of bad) assert.ok(error && r.err.includes(error), r.err);
  for (const r of good) assert.deepEqual(r, good[0], 'all durable retries retain original receipt');
  return good[0];
}
const first = winners(await race('grant', Array(12).fill(grant), Array(12).fill('grant-same')), 12);
const mixed = winners(await race('grant', Array.from({length:12}, (_, i) => ({...grant, consent_type:i % 2 ? 'data_sharing' : 'vehicle_api'})), Array(12).fill('grant-mixed')), 6, 'IDEMPOTENCY_CONFLICT');
winners(await race('grant', Array(12).fill({...grant, consent_type:'flex_participation'}), Array.from({length:12}, (_, i) => `overlap-${i}`)), 1, 'INVALID_STATE_TRANSITION');
const revocation = receipt => ({consent_id:receipt.resource_id, environment:'sandbox', reason_code:'customer_request'});
winners(await race('revoke', Array(12).fill(revocation(first)), Array(12).fill('revoke-same')), 12);
winners(await race('revoke', Array(12).fill(revocation(mixed)), Array.from({length:12}, (_, i) => `revoke-distinct-${i}`)), 1, 'INVALID_STATE_TRANSITION');
const regrant = await api.grantConsent(request(grant, 'regrant'));
assert.notEqual(regrant.resource_id, first.resource_id);
assert.equal((await api.checkConsent(pinned(first))).valid, false, 'regrant cannot resurrect an old queued consent');
assert.equal((await api.checkConsent(pinned(regrant))).valid, true);
// Hold a real transaction open without sleeps. A second connection with lock_timeout
// must fail while the first holds the consent row; release only after observing it.
async function held(command, probe) {
  const child = spawn('psql', args, {stdio:['pipe','pipe','pipe']});
  let out = '', err = '', marked = false;
  let readyResolve, readyReject;
  const ready = new Promise((resolve, reject) => {readyResolve=resolve; readyReject=reject;});
  const done = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => {if (!marked) readyReject(Error('Consent lock was not acquired')); resolve(code);});
  });
  const timer = setTimeout(() => {child.kill('SIGKILL'); readyReject(Error('Consent lock test timed out'));}, 10000);
  child.stdout.on('data', chunk => {out += chunk; if (!marked && out.includes('CONSENT_LOCK_HELD')) {marked=true; readyResolve();}});
  child.stderr.on('data', chunk => {err += chunk;});
  child.stdin.write(`${begin} ${command}\n\\echo CONSENT_LOCK_HELD\n`);
  try {
    await ready;
    const result = await query(`${begin} set local lock_timeout='100ms'; ${probe} commit;`);
    assert.notEqual(result.code, 0); assert.match(result.err, /lock timeout/u);
    child.stdin.end('commit;\n');
    assert.equal(await done, 0, err);
  } finally {clearTimeout(timer); if (child.exitCode === null) child.kill('SIGKILL');}
}
await held(rpc('check', pinned(regrant)), rpc('revoke', revocation(regrant), 'blocked-revoke'));
assert.equal((await api.checkConsent(pinned(regrant))).valid, true);
await held(rpc('revoke', revocation(regrant), 'held-revoke'), rpc('check', pinned(regrant)));
assert.equal((await api.checkConsent(pinned(regrant))).valid, false, 'committed revocation blocks a later queued check');
const counts = JSON.parse(sql(`select jsonb_build_object(
 'consents',(select count(*) from public.consents where tenant_id='${tenant}'),
 'revoked',(select count(*) from public.consents where tenant_id='${tenant}' and status='revoked'),
 'receipts',(select count(*) from public.idempotency_records where tenant_id='${tenant}'),
 'audits',(select count(*) from public.audit_events where tenant_id='${tenant}'),
 'outbox',(select count(*) from public.outbox_events where tenant_id='${tenant}'),
 'unfinished',(select count(*) from public.idempotency_records where tenant_id='${tenant}' and status<>'completed'));`));
assert.deepEqual(counts, {consents:5, revoked:4, receipts:9, audits:9, outbox:9, unfinished:0});
console.log(JSON.stringify({sharedConsentContractCases:cases.length, concurrentConsentRpcCalls:concurrentCalls,
 exactScopeTypedRoundTrips:true, readAndRevocationLocksVerified:true, oldQueuedConsentDenied:true, atomicCounts:counts, physicalCommandsSent:0}));
