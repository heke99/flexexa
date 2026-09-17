import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDevDrift } from './describe-dev-drift.mjs';

const address = 'module.foundation.aws_s3_bucket.storage["audit"]';
const allowed = new Set([address]);
const fixture = () => ({ resource_drift: [{ address, change: {
  actions: ['update'], before: { versioning: [] },
  after: { versioning: [{ enabled: true, secret: 'NEVER_LOG_THIS' }] },
} }] });

test('describes reviewed fields without values or authorizing apply', () => {
  const result = describeDevDrift(fixture(), allowed);
  assert.equal(result.authorizesApply, false);
  assert.equal(result.count, 1);
  assert.deepEqual(result.entries[0].changedFields, ['versioning']);
  assert.ok(!JSON.stringify(result).includes('NEVER_LOG_THIS'));
});
test('redacts arbitrary addresses, actions and field names', () => {
  const plan = fixture();
  plan.resource_drift[0].address = 'NEVER_LOG_ADDRESS';
  plan.resource_drift[0].change.actions = ['NEVER_LOG_ACTION'];
  plan.resource_drift[0].change.after.NEVER_LOG_FIELD = 'NEVER_LOG_VALUE';
  const result = describeDevDrift(plan, allowed);
  assert.ok(!JSON.stringify(result).includes('NEVER_LOG'));
  assert.equal(result.entries[0].address, '[unreviewed resource]');
  assert.equal(result.entries[0].redactedFields, 2);
});
test('redacts unknown keys even on a reviewed resource', () => {
  const plan = fixture();
  plan.resource_drift[0].change.after.NEVER_LOG_FIELD = true;
  const result = describeDevDrift(plan, allowed);
  assert.equal(result.entries[0].redactedFields, 1);
  assert.ok(!JSON.stringify(result).includes('NEVER_LOG'));
});
test('object property ordering is not a difference', () => {
  const plan = fixture();
  plan.resource_drift[0].change.before = { tags: { A: '1', B: '2' } };
  plan.resource_drift[0].change.after = { tags: { B: '2', A: '1' } };
  assert.deepEqual(describeDevDrift(plan, allowed).entries[0].changedFields, []);
});
test('reports removed fields and malformed entries without reflecting input', () => {
  const plan = fixture();
  plan.resource_drift[0].change.after = {};
  plan.resource_drift.push(null, { change: { actions: 'NEVER_LOG' } });
  const result = describeDevDrift(plan, allowed);
  assert.deepEqual(result.entries[0].changedFields, ['versioning']);
  assert.equal(result.entries[1].beforeObject, false);
  assert.ok(!JSON.stringify(result).includes('NEVER_LOG'));
});
test('empty drift remains a diagnostic, not an acceptance result', () => {
  assert.deepEqual(describeDevDrift({}, allowed), {
    diagnostic: 'dev-resource-drift-v1', authorizesApply: false, count: 0, entries: [],
  });
});
for (const value of [null, [], 1, { resource_drift: {} }, { resource_drift: Array(129).fill({}) }]) {
  test(`rejects invalid/bounded input ${JSON.stringify(value).slice(0, 50)}`, () => {
    assert.throws(() => describeDevDrift(value, allowed));
  });
}
