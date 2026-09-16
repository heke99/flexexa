import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(new URL('../../../.github/workflows/opentofu-plan.yml', import.meta.url), 'utf8');
const step = workflow.match(/      - name: Reject untrusted planning context\n([\s\S]*?)(?=      - uses:)/)?.[1];
const shell = step?.split('        run: |\n')[1]?.split('\n').filter(Boolean).map((line) => line.slice(10)).join('\n');
const fixture = () => ({ GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: 'heke99/flexexa',
  GITHUB_REPOSITORY_ID: '1362385793', PR_HEAD_REPO_ID: '1362385793', PR_HEAD_REPO_NAME: 'heke99/flexexa' });
const invoke = (env) => spawnSync('/bin/bash', ['-e', '-c', shell], { env, encoding: 'utf8' });

test('both reviewed PR targets always schedule the required plan without path filters', () => {
  assert.match(workflow, /on:\n  pull_request:\n    branches: \[main, phase\/0-foundation\]\n\npermissions:/);
  assert.doesNotMatch(workflow, /^\s+(paths|paths-ignore|branches-ignore):/m);
});
test('required job does not report success by being conditionally skipped', () => {
  assert.match(workflow, /jobs:\n  plan-dev:\n    runs-on:/);
  assert.doesNotMatch(workflow, /^    (if|needs):/m);
  assert.doesNotMatch(workflow, /continue-on-error:/);
});
test('same-repository check executes before checkout and credential use', () => {
  assert.ok(shell);
  assert.ok(workflow.indexOf('Reject untrusted planning context') < workflow.indexOf('uses: actions/checkout@'));
  assert.ok(workflow.indexOf('Reject untrusted planning context') < workflow.indexOf('uses: aws-actions/'));
  assert.match(step, /PR_HEAD_REPO_ID: \$\{\{ github.event.pull_request.head.repo.id \}\}/);
  assert.match(step, /PR_HEAD_REPO_NAME: \$\{\{ github.event.pull_request.head.repo.full_name \}\}/);
});
test('actual shell accepts the canonical same-repository pull request', () => {
  assert.equal(invoke(fixture()).status, 0);
});
for (const [key, value] of [
  ['GITHUB_EVENT_NAME', 'push'], ['GITHUB_EVENT_NAME', 'pull_request_target'],
  ['GITHUB_EVENT_NAME', 'workflow_dispatch'], ['GITHUB_REPOSITORY', 'other/flexexa'],
  ['GITHUB_REPOSITORY_ID', '1'], ['PR_HEAD_REPO_ID', '2'],
  ['PR_HEAD_REPO_NAME', 'contributor/flexexa'], ['PR_HEAD_REPO_NAME', 'heke99/flexexa\n'],
  ['PR_HEAD_REPO_NAME', '$(exit 0)'], ['PR_HEAD_REPO_ID', '1362385793; exit 0'],
]) test(`actual shell rejects ${key}=${JSON.stringify(value)}`, () => {
  const env = fixture(); env[key] = value;
  assert.notEqual(invoke(env).status, 0);
});
for (const key of Object.keys(fixture())) test(`actual shell denies missing ${key}`, () => {
  const env = fixture(); delete env[key];
  assert.notEqual(invoke(env).status, 0);
});
test('PR planning retains readonly role/state and never performs deployment', () => {
  assert.match(workflow, /role-to-assume: arn:aws:iam::938095765653:role\/flexexa-github-plan\n/);
  assert.doesNotMatch(workflow, /role\/flexexa-github-apply-dev|run:.*tofu apply|pull_request_target:|workflow_dispatch:|\n  push:/);
  assert.match(workflow, /tofu plan -input=false -lock=false -no-color -out=tfplan/);
  assert.match(workflow, /verify-dev-plan.mjs/);
  assert.match(workflow, /-lockfile=readonly/);
  assert.match(workflow, /persist-credentials: false/);
});
