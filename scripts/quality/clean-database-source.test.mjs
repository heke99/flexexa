import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const id = n => `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const scope = {tenant_id:id(1), asset_id:id(2), environment:'sandbox'};
const route = (n, provider) => ({...scope, connection_id:id(n), provider_id:id(n+10),
  provider_account_id:id(n+20), provider_key:provider, external_asset_id:'source-fixture',
  priority:0, connection_status:'connected', account_status:'connected', provider_status:'active',
  health:'healthy', capabilities:['read_soc'], capabilities_verified_at:'2026-09-09T12:00:00Z',
  last_seen_at:'2026-09-09T12:00:00Z', state_observed_at:'2026-09-09T11:00:00Z',
  valid_from:'2026-01-01T00:00:00Z', valid_until:null});
const input = () => ({scope, routes:[route(3,'enode'),route(4,'ocpp')]});
function isolated(t) {
  const directory = mkdtempSync(join(tmpdir(), 'flexexa-clean-source-'));
  t.after(() => rmSync(directory, {recursive:true,force:true}));
  for (const file of ['scripts/database/check-connect-routes.mjs','scripts/database/source-workspace.mjs',
    'packages/domain/package.json','packages/api-contracts/package.json',
    'country-packs/package.json','country-packs/registry.ts','country-packs/se/v1.json']) {
    mkdirSync(dirname(join(directory,file)),{recursive:true});cpSync(join(root,file),join(directory,file));
  }
  for (const name of ['domain','api-contracts']) cpSync(join(root,'packages',name,'src'),join(directory,'packages',name,'src'),{recursive:true});
  assert(!existsSync(join(directory,'node_modules')));
  return directory;
}
function run(directory, value) {
  return spawnSync(process.execPath, ['--experimental-strip-types','scripts/database/check-connect-routes.mjs'],
    {cwd:directory,input:JSON.stringify(value),encoding:'utf8',timeout:15000});
}
test('SQL route decoder boots in clean source checkout before any other database runner', t => {
  const directory = isolated(t), result = run(directory,input());
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{authenticated_sql_routes_validated:2,providers:['enode','ocpp'],environment:'sandbox'});
  assert.equal(readlinkSync(join(directory,'node_modules/@flexexa/domain')),join(directory,'packages/domain'));
  assert.equal(run(directory,input()).status,0,'bootstrap must be repeatable');
});
test('clean source decoder still rejects cross-environment SQL output', t => {
  const directory = isolated(t), payload = input();payload.routes[0].environment = 'production';
  const result = run(directory,payload);assert.notEqual(result.status,0);assert.match(result.stderr,/PERMISSION_DENIED/u);
});
test('clean source decoder still rejects unexpected credential fields', t => {
  const directory = isolated(t), payload = input();payload.routes[0].credential_reference = 'invalid-fixture';
  const result = run(directory,payload);assert.notEqual(result.status,0);assert.match(result.stderr,/VALIDATION_ERROR/u);
});
test('bootstrap refuses existing package link to wrong local code', t => {
  const directory = isolated(t), scopeDir = join(directory,'node_modules/@flexexa');mkdirSync(scopeDir,{recursive:true});
  symlinkSync(join(directory,'packages/api-contracts'),join(scopeDir,'domain'),'dir');
  const result = run(directory,input());assert.notEqual(result.status,0);assert.match(result.stderr,/SOURCE_WORKSPACE_LINK_MISMATCH/u);
});
test('bootstrap refuses dangling package link rather than replacing it', t => {
  const directory = isolated(t), scopeDir = join(directory,'node_modules/@flexexa');mkdirSync(scopeDir,{recursive:true});
  symlinkSync(join(directory,'missing'),join(scopeDir,'domain'),'dir');
  assert.notEqual(run(directory,input()).status,0);
  assert.equal(readlinkSync(join(scopeDir,'domain')),join(directory,'missing'));
});
test('bootstrap refuses redirected node_modules before adding any workspace link', t => {
  const directory = isolated(t), target = join(directory,'outside');mkdirSync(target);
  symlinkSync(target,join(directory,'node_modules'),'dir');
  const result = run(directory,input());assert.notEqual(result.status,0);assert.match(result.stderr,/SOURCE_WORKSPACE_PARENT_MISMATCH/u);
  assert(!existsSync(join(target,'@flexexa')));
});
