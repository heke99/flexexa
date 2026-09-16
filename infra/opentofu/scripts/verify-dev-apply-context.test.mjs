import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { validateInvocation, verifyMainBranch, verifyApplyContext } from './verify-dev-apply-context.mjs';

// Synthetic invocations/HTTP responses test the guard, not live branch protection.
const fixture = () => ({
  GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/main',
  GITHUB_REPOSITORY: 'heke99/flexexa', GITHUB_REPOSITORY_ID: '1362385793',
  GITHUB_REPOSITORY_OWNER_ID: '129280077', GITHUB_SERVER_URL: 'https://github.com',
  GITHUB_API_URL: 'https://api.github.com', FLEXEXA_APPLY_CONFIRM: 'APPLY_DEV',
  GITHUB_SHA: 'a'.repeat(40), GITHUB_RUN_ID: '123', GITHUB_RUN_ATTEMPT: '1',
  GH_TOKEN: 'synthetic-test-token-not-a-credential',
});
const branch = () => ({ name: 'main', commit: { sha: 'a'.repeat(40) }, protected: true });
const response = (body = branch()) => ({ ok: true, status: 200, redirected: false, json: async () => body });

test('accepts only current protected main and emits no token', async () => {
  let calls = 0;
  const env = fixture();
  const result = await verifyApplyContext(env, async (url, options) => {
    calls += 1;
    assert.equal(url, 'https://api.github.com/repos/heke99/flexexa/branches/main');
    assert.equal(options.method, 'GET');
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.headers.Authorization, `Bearer ${env.GH_TOKEN}`);
    return response();
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'passed');
  assert.equal(result.commit, env.GITHUB_SHA);
  assert.ok(!JSON.stringify(result).includes(env.GH_TOKEN));
});

const invalidInvocation = [
  ['GITHUB_ACTIONS', 'false'], ['GITHUB_EVENT_NAME', 'push'], ['GITHUB_EVENT_NAME', 'pull_request'],
  ['GITHUB_EVENT_NAME', 'pull_request_target'], ['GITHUB_REF', 'refs/heads/phase/0-foundation'],
  ['GITHUB_REPOSITORY', 'other/flexexa'], ['GITHUB_REPOSITORY_ID', '1'],
  ['GITHUB_REPOSITORY_OWNER_ID', '1'], ['GITHUB_SERVER_URL', 'https://example.invalid'],
  ['GITHUB_API_URL', 'https://example.invalid'], ['FLEXEXA_APPLY_CONFIRM', 'APPLY_PROD'],
  ['FLEXEXA_APPLY_CONFIRM', ' APPLY_DEV'], ['GITHUB_SHA', 'main'], ['GITHUB_SHA', 'a'.repeat(39)],
  ['GITHUB_SHA', 'a'.repeat(40) + '\n'], ['GITHUB_RUN_ID', '0'], ['GITHUB_RUN_ID', '-1'],
  ['GITHUB_RUN_ATTEMPT', '0'], ['GITHUB_RUN_ATTEMPT', '1.5'], ['GH_TOKEN', '   '],
];
for (const [key, value] of invalidInvocation) test(`rejects ${key}=${JSON.stringify(value)} before HTTP`, async () => {
  const env = fixture(); env[key] = value;
  let called = false;
  await assert.rejects(verifyApplyContext(env, async () => { called = true; return response(); }), /DEV_APPLY_CONTEXT_REJECTED/);
  assert.equal(called, false);
});
for (const key of Object.keys(fixture())) test(`rejects missing ${key}`, () => {
  const env = fixture(); delete env[key];
  assert.throws(() => validateInvocation(env), /DEV_APPLY_CONTEXT_REJECTED/);
});
for (const value of [false, undefined, 'true', 1, null]) test(`rejects unproven protection ${String(value)}`, () => {
  const main = branch(); main.protected = value;
  assert.throws(() => verifyMainBranch(main, validateInvocation(fixture())), /MAIN_BRANCH_NOT_PROTECTED/);
});
for (const value of [null, [], {}, { name: 'main' }, { name: 'other', commit: { sha: 'a'.repeat(40) } }]) {
  test(`rejects malformed main ${JSON.stringify(value)}`, () => assert.throws(
    () => verifyMainBranch(value, validateInvocation(fixture())), /INVALID_BRANCH_RESPONSE/));
}
test('rejects a stale run after main moves', () => {
  const main = branch(); main.commit.sha = 'b'.repeat(40);
  assert.throws(() => verifyMainBranch(main, validateInvocation(fixture())), /STALE_MAIN_COMMIT/);
});
for (const status of [301, 302, 401, 403, 404, 429, 500]) test(`fails closed on HTTP ${status}`, async () => {
  await assert.rejects(verifyApplyContext(fixture(), async () => ({ ...response(), ok: false, status })), /GITHUB_READ_DENIED/);
});
test('rejects redirected responses', async () => {
  await assert.rejects(verifyApplyContext(fixture(), async () => ({ ...response(), redirected: true })), /GITHUB_READ_DENIED/);
});
test('network exceptions never expose upstream text', async () => {
  await assert.rejects(verifyApplyContext(fixture(), async () => { throw new Error(fixture().GH_TOKEN); }),
    { message: 'DEV_APPLY_CONTEXT_REJECTED: GITHUB_READ_FAILED' });
});
test('malformed JSON never exposes response text', async () => {
  await assert.rejects(verifyApplyContext(fixture(), async () => ({ ...response(), json: async () => { throw new Error(fixture().GH_TOKEN); } })),
    { message: 'DEV_APPLY_CONTEXT_REJECTED: INVALID_GITHUB_JSON' });
});
test('CLI fails without context or with extra arguments and leaks no token', () => {
  const executable = fileURLToPath(new URL('./verify-dev-apply-context.mjs', import.meta.url));
  for (const args of [[], ['--ignore-protection']]) {
    const result = spawnSync(process.execPath, [executable, ...args], { env: { GH_TOKEN: fixture().GH_TOKEN }, encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /DEV_APPLY_CONTEXT_REJECTED/);
    assert.ok(!result.stderr.includes(fixture().GH_TOKEN));
  }
});

test('dev lock persists the signed provider version previously observed in real CI', () => {
  const lock = readFileSync(new URL('../environments/dev/.terraform.lock.hcl', import.meta.url), 'utf8');
  assert.match(lock, /provider "registry\.opentofu\.org\/hashicorp\/aws"/);
  assert.match(lock, /version\s*= "6\.64\.0"/);
  assert.match(lock, /zh:82a413500c35241745e097797610d2bff57c26e29f34ca711182fdde5c265d13/);
});

const workflow = (name) => readFileSync(new URL(`../../../.github/workflows/opentofu-${name}.yml`, import.meta.url), 'utf8');
for (const name of ['plan', 'apply']) {
  test(`${name} workflow keeps provider installation readonly and checks file integrity`, () => {
    const yaml = workflow(name);
    assert.match(yaml, /tofu init -input=false -lockfile=readonly -backend-config=/);
    assert.match(yaml, /git diff --exit-code -- \.terraform\.lock\.hcl/);
    assert.match(yaml, /persist-credentials: false/);
    assert.match(yaml, /node --test infra\/opentofu\/scripts\/\*\.test\.mjs/);
    assert.doesNotMatch(yaml, /continue-on-error: true/);
  });
}
test('apply remains manual main-only, rechecks protection, then applies only the saved plan', () => {
  const yaml = workflow('apply');
  assert.match(yaml, /workflow_dispatch:/);
  assert.doesNotMatch(yaml, /\n  (push|pull_request|pull_request_target|workflow_run):/);
  assert.match(yaml, /github\.ref == 'refs\/heads\/main' && inputs\.confirm == 'APPLY_DEV'/);
  const checks = [...yaml.matchAll(/run: node infra\/opentofu\/scripts\/verify-dev-apply-context\.mjs/g)].map((m) => m.index);
  assert.equal(checks.length, 2);
  assert.ok(checks[0] < yaml.indexOf('uses: aws-actions/configure-aws-credentials@'));
  assert.ok(checks[1] > yaml.indexOf('pre-apply-safety.json'));
  assert.ok(checks[1] < yaml.indexOf('run: tofu apply'));
  assert.match(yaml, /run: tofu apply -input=false -lock-timeout=5m -auto-approve tfplan/);
  assert.doesNotMatch(yaml, /-lock=false/);
  assert.match(yaml, /-detailed-exitcode/);
});
