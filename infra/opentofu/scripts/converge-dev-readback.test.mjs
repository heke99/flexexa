import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Shell orchestration tests; the verifier is exercised independently against
// 52-resource plans. These mocks are not live AWS or OpenTofu evidence.
const script = fileURLToPath(new URL('./converge-dev-readback.sh', import.meta.url));
function run(extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'flexexa-converge-'));
  try {
    writeFileSync(join(dir, 'tofu'), `#!/bin/bash
set -eu
echo "tofu:$*" >> "$TRACE"
case "$1" in
plan) exit "\${PLAN_EXIT:-0}";;
show) printf '{"secret":"NEVER_LOG_SECRET"}'; exit "\${SHOW_EXIT:-0}";;
apply) exit "\${APPLY_EXIT:-0}";;
*) exit 99;;
esac
`, { mode: 0o700 });
    writeFileSync(join(dir, 'node'), `#!/bin/bash
set -eu
case "$1" in
*verify-dev-plan.mjs)
  echo "safety:$4" >> "$TRACE"
  echo "$2" > "$RAW_PATH"
  exit "\${SAFETY_EXIT:-0}";;
*verify-dev-apply-context.mjs)
  echo context >> "$TRACE"
  exit "\${CONTEXT_EXIT:-0}";;
*) exit 99;;
esac
`, { mode: 0o700 });
    const trace = join(dir, 'trace'); const rawPath = join(dir, 'raw-path');
    const result = spawnSync('bash', [script], { cwd: dir, encoding: 'utf8',
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TRACE: trace, RAW_PATH: rawPath, ...extra },
    });
    const calls = existsSync(trace) ? readFileSync(trace, 'utf8').trim().split('\n') : [];
    assert.ok(!`${result.stdout}${result.stderr}`.includes('NEVER_LOG_SECRET'));
    if (existsSync(rawPath)) assert.equal(existsSync(readFileSync(rawPath, 'utf8').trim()), false, 'raw JSON must be cleaned');
    return { status: result.status, calls };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('checks zero-change exit, saved-plan verifier and current main before one apply', () => {
  const result = run(); assert.equal(result.status, 0);
  assert.equal(result.calls.length, 5);
  assert.match(result.calls[0], /^tofu:plan .* -detailed-exitcode .* -out=readback.tfplan$/);
  assert.equal(result.calls[1], 'tofu:show -json readback.tfplan');
  assert.equal(result.calls[2], 'safety:--require-noop');
  assert.equal(result.calls[3], 'context');
  assert.match(result.calls[4], /^tofu:apply .* readback.tfplan$/);
});
for (const [name, extra, count] of [
  ['planning failure', { PLAN_EXIT: '1' }, 1],
  ['planned changes', { PLAN_EXIT: '2' }, 1],
  ['unexpected planner exit', { PLAN_EXIT: '9' }, 1],
  ['failed JSON rendering', { SHOW_EXIT: '1' }, 2],
  ['unreviewed drift', { SAFETY_EXIT: '1' }, 3],
  ['stale or unprotected main', { CONTEXT_EXIT: '1' }, 4],
]) test(`does not apply after ${name}`, () => {
  const result = run(extra); assert.notEqual(result.status, 0);
  assert.equal(result.calls.length, count);
  assert.ok(!result.calls.some((line) => line.startsWith('tofu:apply')));
});
test('saved-plan apply failure propagates without retry', () => {
  const result = run({ APPLY_EXIT: '1' }); assert.equal(result.status, 1);
  assert.equal(result.calls.filter((line) => line.startsWith('tofu:apply')).length, 1);
});
test('workflow requires convergence then strict post-apply evidence without promoting PRs', () => {
  const text = readFileSync(new URL('../../../.github/workflows/opentofu-apply.yml', import.meta.url), 'utf8');
  const start = text.indexOf('name: Reconcile reviewed readback projections');
  const end = text.indexOf('name: Verify zero drift after apply');
  assert.ok(start > text.indexOf('name: Apply the validated saved plan'));
  assert.ok(end > start);
  assert.match(text.slice(start, end), /GH_TOKEN: \$\{\{ github.token \}\}/);
  assert.match(text.slice(start, end), /FLEXEXA_APPLY_CONFIRM: \$\{\{ inputs.confirm \}\}/);
  assert.match(text.slice(start, end), /bash ..\/..\/scripts\/converge-dev-readback.sh/);
  assert.match(text.slice(end), /post-apply-safety.json --require-converged/);
  assert.match(text, /github.ref == 'refs\/heads\/main'/);
  assert.doesNotMatch(text, /continue-on-error|pull_request_target|refresh=false|ignore_changes/);
});
