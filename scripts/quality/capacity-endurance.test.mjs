import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { enduranceStorageGuard } from './capacity-endurance.mjs';
import { capacityIdentity } from './capacity-identity.mjs';
import { measureMixedReads } from './capacity-mixed-routes.mjs';
import { capacityTimings } from './capacity-timings.mjs';

const unpack = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));

test('endurance credentials renew while preserving authentication time, OAuth and the durable session', () => {
  let epochMs = 10_000;
  const identity = capacityIdentity({ issuer: 'https://capacity.test', lifetimeSeconds: 5, renew: true, clock: () => epochMs });
  const credential = identity.credential('subject', { oauthClientId: 'registered-client' });
  const first = credential();
  epochMs = 14_000;
  const second = credential();
  assert.notEqual(first, second);
  assert.equal(identity.user(first).id, 'subject');
  assert.equal(unpack(second).session_id, unpack(first).session_id);
  assert.equal(unpack(second).client_id, unpack(first).client_id);
  assert.deepEqual(unpack(second).amr, unpack(first).amr);
  assert.equal(unpack(second).iat, 14);
  epochMs = 15_000;
  assert.equal(identity.user(first), null);
  for (let iteration = 0; iteration < 1_000; iteration += 1) {
    epochMs += 4_000;
    assert.equal(identity.user(credential()).id, 'subject');
  }
  assert.deepEqual(identity.stats(), { sessions: 1, renewals: 1_001, registeredTestTokens: 2 });
});

test('bounded and exact latency recorders retain counts and report their known percentile range', () => {
  const exact = capacityTimings(), bounded = capacityTimings(true);
  assert.equal(exact.percentile(0.95), null);
  assert.equal(bounded.percentile(0.95), null);
  for (let latency = 1; latency <= 1_000; latency += 1) {
    exact.add(latency);
    bounded.add(latency);
  }
  assert.equal(exact.percentile(0.95), 950);
  assert.ok(Math.abs(bounded.percentile(0.95) - 950) <= 1);
  assert.ok(Math.abs(bounded.percentile(0.99) - 990) <= 1);
  assert.equal(bounded.count, 1_000);
  bounded.add(86_400_001);
  assert.equal(bounded.count, 1_001);
  assert.equal(bounded.clipped, 1);
});

test('unavailable scratch storage stops the schedule before issuing a request', async () => {
  const disk = await enduranceStorageGuard(join(tmpdir(), randomUUID(), 'absent'));
  try {
    assert.equal(disk.signal.reason, 'SCRATCH_SPACE_UNAVAILABLE');
    const sampled = await measureMixedReads(() => assert.fail('disk stop must prevent requests'), {}, 100, 600,
      { bounded: true, signal: disk.signal });
    assert.equal(sampled.plannedRequests, 60_000);
    assert.equal(sampled.requests, 0);
    assert.deepEqual(sampled.routeSamples, []);
  } finally {
    assert.equal(disk.stop().stopReason, 'SCRATCH_SPACE_UNAVAILABLE');
  }
});
