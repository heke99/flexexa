import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { profile } from './capacity-profile.mjs';

const capabilities = ['read_soc', 'start_charge', 'stop_charge', 'set_power_limit'];

function reading(asset, version) {
  return {
    accountId: asset.accountId, vehicleId: asset.vehicleId,
    make: 'Synthetic', model: 'Capacity fixture',
    batteryKwh: 60, efficiency: 0.9, minKw: 0, maxKw: 11, capabilities,
    soc: 20 + (asset.number + version) % 60, plugged: true, powerKw: 3.6,
    energyWh: asset.number * 10 + version * 3,
    reportedAt: Date.parse('2026-11-22T00:00:00Z') + version * 1_000, stateVersion: version,
  };
}

export function telemetryFixture({ EnergyService, storeEnergyShadow, simulatedEnergyAdapter }, db, service) {
  const snapshots = new Map();
  const latest = new Map();
  let refreshCalls = 0;
  const simulation = {
    mode: 'simulation',
    async getAsset({ vehicleId }) {
      refreshCalls += 1;
      return snapshots.get(vehicleId);
    },
    async executeCommand() { throw new Error('The telemetry probe does not send commands'); },
    async getCommandResult() { throw new Error('The telemetry probe does not issue commands'); },
  };
  const energy = new EnergyService(db, { service, simulationEnabled: true, provider: simulation });
  let assets;

  async function seed(pool, vehicles, fixtures) {
    assets = vehicles.map((vehicle, index) => ({
      accountId: fixtures.owners.get(vehicle.tenantId).tenant.id,
      vehicleId: fixtures.testVehicleIds.get(vehicle.vehicleId),
      number: index + 1,
    }));
    await pool.query(`
      INSERT INTO charging_subscription.energy_vehicle_profiles
        (account_id,vehicle_id,provider_key,is_simulated,make,model,battery_kwh,efficiency,min_kw,max_kw,
         capabilities,target_percent,mode,available_from,departure_at,priority,consent_at)
      SELECT account, vehicle, 'simulator', true, 'Synthetic', 'Capacity fixture', 60, 0.9, 0, 11,
             $3::jsonb, 70, 'smart', now(), now()+interval '12 hours', 1, now()
      FROM unnest($1::uuid[],$2::uuid[]) AS fixture(account,vehicle)
    `, [assets.map(asset => asset.accountId), assets.map(asset => asset.vehicleId), JSON.stringify(capabilities)]);
  }

  async function verifyRefresh(request, fixtures) {
    const asset = assets[0];
    const owner = fixtures.owners.values().next().value;
    const route = `energy-vehicles/${asset.vehicleId}/refresh`;
    const post = (actor, account = actor.tenant.id) =>
      request(actor, route, { account, method: 'POST', body: '{}', key: 'read-only-simulation-refresh' });
    const initial = reading(asset, 1);
    const fresh = reading(asset, 3);
    snapshots.set(asset.vehicleId, initial);
    const priorCalls = refreshCalls;
    assert.equal((await post(fixtures.control)).status, 404);
    assert.equal((await post(fixtures.control, asset.accountId)).status, 403);
    assert.equal((await post(fixtures.driver)).status, 403);
    assert.equal(refreshCalls, priorCalls);
    assert.equal((await post(owner)).status, 200);
    snapshots.set(asset.vehicleId, fresh);
    const newer = await post(owner);
    assert.equal(newer.status, 200);
    assert.equal(newer.body.stateVersion, 3);
    assert.equal((await post(owner)).status, 200);
    for (const invalid of [reading(asset, 2), { ...fresh, energyWh: fresh.energyWh + 2 }]) {
      snapshots.set(asset.vehicleId, invalid);
      const rejected = await post(owner);
      assert.equal(rejected.status, 409);
      assert.equal(rejected.body.error, 'ENERGY_TELEMETRY_VERSION_CONFLICT');
    }
    snapshots.set(asset.vehicleId, { ...fresh, accountId: fixtures.control.tenant.id });
    const wrongAsset = await post(owner);
    assert.equal(wrongAsset.status, 502);
    assert.equal(wrongAsset.body.error, 'PROVIDER_ASSET_MISMATCH');
    const observed = await request(owner, 'energy-vehicles');
    assert.equal(observed.status, 200);
    const stored = observed.body.items.find(row => row.vehicle_id === asset.vehicleId);
    assert.deepEqual([stored.state_version, Number(stored.energy_wh), stored.quality], [3, fresh.energyWh, 'simulated']);
    assert.equal((await request(fixtures.control, 'energy-vehicles', { account: asset.accountId })).status, 403);
    assert.deepEqual((await request(fixtures.control, 'energy-vehicles')).body.items, []);
    latest.set(asset.vehicleId, fresh);
    return { refreshAccepted: 3, exactReplay: 1, conflictsRejected: 2, scopeDenials: 4, wrongProviderAssetRejected: 1 };
  }

  function scheduledEvents(kind, duration) {
    const baseline = profile.load.normal.telemetryEventsPerSecond;
    const rate = kind === 'peak' ? profile.load.peak.telemetryEventsPerSecond : baseline;
    const waves = [{ count: duration * rate, rate, source: 'normal_observation' }];
    if (kind === 'reconnect') waves.push({
      count: profile.load.reconnect.additionalEvents,
      rate: profile.load.reconnect.additionalEvents / duration,
      source: 'reconnect_observation',
    });
    const versions = { normal: 1_000, peak: 10_000, reconnect: 30_000 };
    return waves.flatMap(wave => Array.from({ length: wave.count }, (_, index) => ({
      target: assets[index % assets.length], offsetMs: index * 1_000 / wave.rate, source: wave.source,
    }))).sort((left, right) => left.offsetMs - right.offsetMs)
      .map((event, index) => ({ ...event, version: versions[kind] + index }));
  }

  async function measure(kind, duration) {
    const events = scheduledEvents(kind, duration);
    const latencies = [];
    const active = new Set();
    const perVehicle = new Map();
    const committedBySource = {};
    const failures = {};
    let dropped = 0;
    let maxInFlight = 0;
    const started = performance.now();
    for (const event of events) {
      const when = started + event.offsetMs;
      const waiting = when - performance.now();
      if (waiting > 0) await delay(waiting);
      if (active.size >= 400) {
        dropped += 1;
        continue;
      }
      const { target } = event;
      const next = reading(target, event.version);
      const adapter = simulatedEnergyAdapter({ ...simulation, getAsset: async () => next });
      const previous = perVehicle.get(target.vehicleId) ?? Promise.resolve();
      const operation = previous.then(async () => {
        const sample = await adapter.read({ accountId: target.accountId, vehicleId: target.vehicleId });
        await db.transaction('worker', client => storeEnergyShadow(client, sample));
        latencies.push(performance.now() - when);
        latest.set(target.vehicleId, next);
        committedBySource[event.source] = (committedBySource[event.source] ?? 0) + 1;
      }).catch(error => {
        const code = error.code ?? 'TELEMETRY_WRITE_ERROR';
        failures[code] = (failures[code] ?? 0) + 1;
      }).finally(() => {
        active.delete(operation);
        if (perVehicle.get(target.vehicleId) === operation) perVehicle.delete(target.vehicleId);
      });
      active.add(operation);
      perVehicle.set(target.vehicleId, operation);
      maxInFlight = Math.max(maxInFlight, active.size);
    }
    await Promise.all(active);
    const observedSeconds = (performance.now() - started) / 1_000;
    latencies.sort((left, right) => left - right);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
    return {
      phase: kind, scheduledSeconds: duration, scheduled: events.length, committed: latencies.length,
      committedBySource, dropped, failures, maxInFlight, observedSeconds: Number(observedSeconds.toFixed(3)),
      p95MsScheduledToShadowCommit: p95 === undefined ? null : Number(p95.toFixed(1)),
      allObservationsCommitted: latencies.length === events.length,
    };
  }

  async function reconcile(request, fixtures) {
    const stored = await db.transaction('worker', client => client.query(`
      SELECT account_id, vehicle_id, energy_wh, state_version, reported_at, quality
      FROM charging_subscription.energy_vehicle_shadows
    `));
    assert.equal(stored.rows.length, latest.size);
    let expectedEnergyWh = 0;
    let storedEnergyWh = 0;
    for (const row of stored.rows) {
      const expected = latest.get(row.vehicle_id);
      assert.ok(expected, 'Current shadow returned a different vehicle');
      assert.deepEqual([row.account_id, row.state_version, Number(row.energy_wh), +row.reported_at, row.quality],
        [expected.accountId, expected.stateVersion, expected.energyWh, expected.reportedAt, 'simulated']);
      expectedEnergyWh += expected.energyWh;
      storedEnergyWh += Number(row.energy_wh);
    }
    assert.equal(storedEnergyWh, expectedEnergyWh);
    const owner = fixtures.owners.values().next().value;
    const visible = await request(owner, 'energy-vehicles');
    assert.equal(visible.status, 200);
    assert.equal(visible.body.items.length, owner.tenant.vehicleIds.length);
    for (const row of visible.body.items) {
      assert.ok(owner.tenant.vehicleSet.has(row.vehicle_id));
      const expected = latest.get(row.vehicle_id);
      assert.deepEqual([row.state_version, row.energy_wh === null ? null : Number(row.energy_wh)],
        expected ? [expected.stateVersion, expected.energyWh] : [null, null]);
    }
    return { shadowRows: stored.rows.length, ownerVisibleVehicles: visible.body.items.length,
      storedEnergyWh, expectedEnergyWh, incorrectRows: 0 };
  }

  return { energy, seed, verifyRefresh, measure, reconcile };
}
