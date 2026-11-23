import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { enduranceStorageGuard, projectEnduranceStorage } from './capacity-endurance.mjs';
import { capacityIdentity } from './capacity-identity.mjs';
import { httpSamplesMeetThresholds, measureMixedReads } from './capacity-mixed-routes.mjs';
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


test('24-hour storage preflight reserves space beyond the measured telemetry relation', () => {
  const sample = { scope: 'local_loopback_native_postgres', phase: 'endurance', revision: 'local-fixture',
    endurance: { scheduleCompleted: true, telemetryRelationBytes: 46_751_744 },
    telemetry: { samples: [{ committed: 138_000, allObservationsCommitted: true }],
      reconciliation: { history: { available: true, observations: 138_003 } } } };
  const mib = 1_048_576;
  const short = projectEnduranceStorage(sample, 4_721 * mib);
  assert.equal(short.projectedRows, 19_872_003);
  assert.equal(short.projectedRelationMiB, 6_421);
  assert.equal(short.minimumRequiredMiB, 6_933);
  assert.equal(short.shortfallMiB, 2_212);
  assert.equal(short.fitsRelationAndGuard, false);
  assert.equal(projectEnduranceStorage(sample, short.minimumRequiredMiB * mib).fitsRelationAndGuard, true);
  assert.throws(() => projectEnduranceStorage({ ...sample, phase: 'peak' }, 10_000 * mib), /completed native endurance/);
});


test('a read threshold or required denial failure rejects a completed capacity sample', () => {
  const passed = { withinProposedThresholds: true };
  const exceeded = { withinProposedThresholds: false };
  const denied = { accessChecksPassed: true };
  const unexpectedDenial = { accessChecksPassed: false };
  assert.equal(httpSamplesMeetThresholds([passed, { routeSamples: [passed, denied] }]), true);
  assert.equal(httpSamplesMeetThresholds([exceeded]), false);
  assert.equal(httpSamplesMeetThresholds([{ routeSamples: [exceeded, denied] }]), false);
  assert.equal(httpSamplesMeetThresholds([{ routeSamples: [passed, unexpectedDenial] }]), false);
});
