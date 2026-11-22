import assert from 'node:assert/strict';
import test from 'node:test';
import { principalRows, profile, sessionRows, vehicleRows } from './capacity-profile.mjs';

for (const [scenario, expectedTenantCount] of [['distributed', 12], ['concentrated', 1], ['quick', 1]]) {
  test(`${scenario} uses distinct active vehicles, variable sites and the right tenant boundaries`, () => {
    const vehicles = [...vehicleRows(scenario)];
    const expectedCount = scenario === 'quick' ? 1_000 : 12_000;
    assert.equal(vehicles.length, expectedCount);
    assert.equal(new Set(vehicles.map(vehicle => vehicle.vehicleId)).size, expectedCount);
    assert.ok(vehicles.every(vehicle => vehicle.registered && vehicle.activated));
    assert.equal(vehicles.filter(vehicle => vehicle.deviceState === 'charging').length, expectedCount / 4);
    assert.deepEqual(new Set(vehicles.map(vehicle => vehicle.deviceState)),
      new Set(['charging', 'waiting', 'stale', 'disconnected']));
    assert.deepEqual(new Set(vehicles.map(vehicle => vehicle.customerType)), new Set(['company', 'private_delegated']));

    const tenants = new Map();
    const sites = new Map();
    for (const vehicle of vehicles) {
      tenants.set(vehicle.tenantId, (tenants.get(vehicle.tenantId) ?? 0) + 1);
      const site = sites.get(vehicle.siteId) ?? { tenantId: vehicle.tenantId, count: 0, providers: new Set() };
      assert.equal(site.tenantId, vehicle.tenantId);
      site.count += 1;
      site.providers.add(vehicle.providerId);
      sites.set(vehicle.siteId, site);
    }
    assert.equal(sites.size, expectedCount / 1_000 * 7);
    assert.deepEqual(new Set([...sites.values()].map(site => site.count)), new Set([40, 60, 100, 140, 180, 220, 260]));
    assert.ok([...sites.values()].every(site => site.providers.size === 2));
    assert.equal(tenants.size, expectedTenantCount);
    assert.ok([...tenants.values()].every(count => count === expectedCount / expectedTenantCount));
  });
}

test('test principals retain separate product access and platform scope', () => {
  const principals = [...principalRows('concentrated')];
  assert.equal(new Set(principals.map(principal => principal.principalId)).size, principals.length);
  const tenantProducts = new Map(principals.filter(principal => principal.tenantId)
    .map(principal => [principal.tenantId, principal.products]));
  assert.deepEqual(tenantProducts, new Map([
    ['fleet-1', ['optimization', 'subscription']],
    ['control-1', ['optimization']],
    ['control-2', ['subscription']],
  ]));
  for (const [client, roles] of Object.entries(profile.fixture.clientRoles)) {
    assert.deepEqual(new Set(principals.filter(principal => principal.client === client).map(principal => principal.role)),
      new Set(roles));
  }
  assert.deepEqual(principals.filter(principal => principal.tenantId === null), [{
    principalId: 'platform-superadmin', tenantId: null, client: 'superadmin', role: 'superadmin', products: [],
  }]);
});

test('session history spans all 12 billing periods with stable IDs and cross-period late costs', () => {
  const iterator = vehicleRows('distributed');
  const first = iterator.next().value;
  const second = iterator.next().value;
  const history = [...sessionRows([first, second])];
  assert.equal(history.length, 1_460);
  assert.equal(new Set(history.map(session => session.sessionId)).size, history.length);
  assert.equal(new Set(history.map(session => session.billingPeriod)).size, 12);
  assert.equal(history[0].startedAt, '2025-01-01T00:00:00.000Z');
  assert.equal(history.at(-1).startedAt, '2025-12-31T12:00:00.000Z');
  assert.ok(history.every(session => session.tenantId === first.tenantId
    && Number.isSafeInteger(session.energyWh) && Number.isSafeInteger(session.costMinor)));
  assert.ok(history.some(session => session.creditMinor > 0
    && session.receivedAt.slice(0, 7) > session.billingPeriod));
  assert.equal(profile.fixture.history.targetSessionRows, history.length / 2 * 12_000);
});

test('profile preserves proposed rates, durations, and gates measured in canonical units', () => {
  assert.equal(profile.vehicleCapacityMinimum, 12_000);
  assert.equal(profile.load.concurrentChargingSessions, 3_000);
  assert.deepEqual(profile.load.normal, { telemetryEventsPerSecond: 230, apiRequestsPerSecond: 100 });
  assert.deepEqual(profile.load.peak, { telemetryEventsPerSecond: 600, apiRequestsPerSecond: 300, durationSeconds: 600 });
  assert.deepEqual(profile.load.reconnect, { additionalEvents: 12_000, durationSeconds: 60 });
  assert.equal(profile.load.enduranceSeconds, 86_400);
  assert.deepEqual(profile.thresholds, {
    criticalReadP95Ms: 500,
    criticalReadUnexpectedErrorRatioMax: 0.005,
    durableJobAckP95Ms: 1_000,
    telemetryStatusP95Seconds: 30,
    readyJobQueueP95Seconds: 60,
    completeFleetReplanSeconds: 900,
    recoverQueueAgeSeconds: 1_800,
    closeBillingPeriodSeconds: 14_400,
    acceptedEventsLost: 0,
    duplicateBusinessEffects: 0,
    unauthorizedAccesses: 0,
    confirmedSiteLimitViolations: 0,
  });
});
