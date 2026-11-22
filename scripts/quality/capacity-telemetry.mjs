import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { profile } from './capacity-profile.mjs';

const capabilities = ['read_soc', 'start_charge', 'stop_charge', 'set_power_limit'];
const meteredCapabilities = [...capabilities, 'read_energy'];

function reading(asset, version, reportedAt = Date.parse('2026-11-22T00:00:00Z') + version * 1_000) {
  return {
    accountId: asset.accountId, vehicleId: asset.vehicleId,
    make: 'Synthetic', model: 'Capacity fixture',
    batteryKwh: 60, efficiency: 0.9, minKw: 0, maxKw: 11,
    capabilities: asset.meterEpoch ? meteredCapabilities : capabilities,
    soc: 20 + (asset.number + version) % 60, plugged: true, powerKw: 3.6,
    energyWh: asset.number * 10 + version * 3,
    reportedAt, stateVersion: version,
    ...(asset.meterEpoch ? { meterEpoch: asset.meterEpoch } : {}),
  };
}

export function telemetryFixture({ EnergyService, storeEnergyShadow, simulatedEnergyAdapter }, db, service,
  { metered = false, telemetryDb = db } = {}) {
  const snapshots = new Map();
  const latest = new Map();
  const historyExpected = new Map();
  let refreshCalls = 0;
  let nextVersion = 1_000;
  let historyAvailable = false;
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
    const { rows: [history] } = await pool.query(`
      SELECT to_regclass('charging_subscription.simulated_energy_telemetry') IS NOT NULL AS available
    `);
    historyAvailable = history.available;
    assert.ok(!metered || historyAvailable, 'Metered probes require the simulator history migration');
    assets = vehicles.map((vehicle, index) => ({
      accountId: fixtures.owners.get(vehicle.tenantId).tenant.id,
      vehicleId: fixtures.testVehicleIds.get(vehicle.vehicleId),
      number: index + 1,
      meterEpoch: metered && index % 4 === 0 ? randomUUID() : null,
    }));
    await pool.query(`
      INSERT INTO charging_subscription.energy_vehicle_profiles
        (account_id,vehicle_id,provider_key,is_simulated,make,model,battery_kwh,efficiency,min_kw,max_kw,
         capabilities,target_percent,mode,available_from,departure_at,priority,consent_at)
      SELECT account, vehicle, 'simulator', true, 'Synthetic', 'Capacity fixture', 60, 0.9, 0, 11,
             CASE WHEN metered THEN $4::jsonb ELSE $3::jsonb END,
             70, 'smart', now(), now()+interval '12 hours', 1, now()
      FROM unnest($1::uuid[],$2::uuid[],$5::boolean[]) AS fixture(account,vehicle,metered)
    `, [assets.map(asset => asset.accountId), assets.map(asset => asset.vehicleId), JSON.stringify(capabilities),
      JSON.stringify(meteredCapabilities), assets.map(asset => !!asset.meterEpoch)]);
  }

  function recordExpectedHistory(sample) {
    if (!historyAvailable) return;
    let totals = historyExpected.get(sample.accountId);
    if (!totals) {
      totals = { observations: 0, meteredObservations: 0, cumulativeEnergyWh: 0, versionSum: 0 };
      historyExpected.set(sample.accountId, totals);
    }
    totals.observations += 1;
    if (sample.meterEpoch) totals.meteredObservations += 1;
    totals.cumulativeEnergyWh += sample.energyWh;
    totals.versionSum += sample.stateVersion;
  }

  async function verifyRefresh(request, fixtures) {
    const asset = assets[0];
    const owner = fixtures.owners.values().next().value;
    const route = `energy-vehicles/${asset.vehicleId}/refresh`;
    const post = (actor, account = actor.tenant.id) =>
      request(actor, route, { account, method: 'POST', body: '{}', key: 'read-only-simulation-refresh' });
    const initial = reading(asset, 1);
    const late = reading(asset, 2);
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
    for (const invalid of [late, { ...fresh, energyWh: fresh.energyWh + 2 }]) {
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
    if (historyAvailable) {
      const { rows: samples } = await db.transaction('worker', client => client.query(`
        SELECT state_version, energy_wh, reported_at, meter_epoch FROM charging_subscription.simulated_energy_telemetry
        WHERE account_id=$1 AND vehicle_id=$2 AND provider_key='simulator' ORDER BY state_version
      `, [asset.accountId, asset.vehicleId]));
      const expected = [initial, late, fresh];
      assert.deepEqual(samples.map(row => [row.state_version, Number(row.energy_wh), +row.reported_at, row.meter_epoch]),
        expected.map(sample => [sample.stateVersion, sample.energyWh, sample.reportedAt, sample.meterEpoch ?? null]));
      for (const sample of expected) recordExpectedHistory(sample);
    }
    return { refreshAccepted: 3, exactReplay: 1, conflictsRejected: 2, scopeDenials: 4, wrongProviderAssetRejected: 1 };
  }

  function* scheduledEvents(kind, duration) {
    const baseline = profile.load.normal.telemetryEventsPerSecond;
    const rate = kind === 'peak' ? profile.load.peak.telemetryEventsPerSecond : baseline;
    const baseCount = duration * rate;
    const reconnectCount = kind === 'reconnect' ? profile.load.reconnect.additionalEvents : 0;
    let base = 0;
    let reconnect = 0;
    while (base < baseCount || reconnect < reconnectCount) {
      const nextBase = base < baseCount ? base * 1_000 / rate : Infinity;
      const nextReconnect = reconnect < reconnectCount ? reconnect * duration * 1_000 / reconnectCount : Infinity;
      const reconnecting = nextReconnect < nextBase;
      const index = reconnecting ? reconnect++ : base++;
      // This step is coprime to the 12,000-vehicle corpus, spreading successive observations across all fleet cohorts.
      const target = assets[index * 7_919 % assets.length];
      const source = reconnecting ? 'reconnect_observation' : kind === 'peak' ? 'peak_observation' : 'normal_observation';
      yield { target, offsetMs: Math.min(nextBase, nextReconnect), source, version: nextVersion++ };
    }
  }

  async function measure(kind, duration) {
    const events = scheduledEvents(kind, duration);
    const latencies = [];
    const active = new Set();
    const perVehicle = new Map();
    const committedBySource = {};
    const failures = {};
    let scheduled = 0;
    let dropped = 0;
    let maxInFlight = 0;
    const started = performance.now();
    const startedAt = Date.now();
    for (const event of events) {
      scheduled += 1;
      const when = started + event.offsetMs;
      const waiting = when - performance.now();
      if (waiting > 0) await delay(waiting);
      if (active.size >= 400) {
        dropped += 1;
        continue;
      }
      const { target } = event;
      const next = reading(target, event.version, startedAt + Math.floor(event.offsetMs));
      const adapter = simulatedEnergyAdapter({ ...simulation, getAsset: async () => next });
      const previous = perVehicle.get(target.vehicleId) ?? Promise.resolve();
      const operation = previous.then(async () => {
        const sample = await adapter.read({ accountId: target.accountId, vehicleId: target.vehicleId });
        await telemetryDb.transaction('worker', client => storeEnergyShadow(client, sample));
        latencies.push(performance.now() - when);
        latest.set(target.vehicleId, next);
        recordExpectedHistory(next);
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
      phase: kind, scheduledSeconds: duration, scheduled, committed: latencies.length,
      committedBySource, dropped, failures, maxInFlight, observedSeconds: Number(observedSeconds.toFixed(3)),
      p95MsScheduledToShadowCommit: p95 === undefined ? null : Number(p95.toFixed(1)),
      allObservationsCommitted: latencies.length === scheduled,
    };
  }

  async function reconcile(request, fixtures) {
    const stored = await db.transaction('worker', client => client.query(`
      SELECT account_id, vehicle_id, energy_wh, state_version, reported_at, quality${historyAvailable ? ',meter_epoch' : ''}
      FROM charging_subscription.energy_vehicle_shadows
    `));
    assert.equal(stored.rows.length, latest.size);
    let expectedEnergyWh = 0;
    let storedEnergyWh = 0;
    let meteredShadowRows = 0;
    for (const row of stored.rows) {
      const expected = latest.get(row.vehicle_id);
      assert.ok(expected, 'Current shadow returned a different vehicle');
      assert.deepEqual([row.account_id, row.state_version, Number(row.energy_wh), +row.reported_at, row.quality],
        [expected.accountId, expected.stateVersion, expected.energyWh, expected.reportedAt, 'simulated']);
      if (historyAvailable) assert.equal(row.meter_epoch, expected.meterEpoch ?? null);
      if (expected.meterEpoch) meteredShadowRows += 1;
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
      if (historyAvailable) assert.equal(row.reported_meter_epoch, expected?.meterEpoch ?? null);
    }
    const history = historyAvailable ? await reconcileHistory() : { available: false };
    return { shadowRows: stored.rows.length, meteredShadowRows,
      meteredFixtureVehicles: metered ? assets.filter(asset => asset.meterEpoch).length : 0,
      ownerVisibleVehicles: visible.body.items.length,
      storedEnergyWh, expectedEnergyWh, incorrectRows: 0, history };
  }

  async function reconcileHistory() {
    const { rows } = await db.transaction('worker', client => client.query(`
      SELECT account_id, count(*)::int AS observations, count(DISTINCT state_version)::int AS distinct_versions,
             count(*) FILTER (WHERE meter_epoch IS NOT NULL)::int AS metered_observations,
             sum(energy_wh) AS cumulative_energy_wh, sum(state_version) AS version_sum
      FROM charging_subscription.simulated_energy_telemetry
      WHERE provider_key='simulator'
      GROUP BY account_id
    `));
    assert.equal(rows.length, historyExpected.size);
    let observations = 0;
    let meteredObservations = 0;
    for (const row of rows) {
      assert.ok(historyExpected.has(row.account_id));
      assert.equal(row.observations, row.distinct_versions);
      assert.deepEqual({
        observations: row.observations, meteredObservations: row.metered_observations,
        cumulativeEnergyWh: Number(row.cumulative_energy_wh),
        versionSum: Number(row.version_sum),
      }, historyExpected.get(row.account_id));
      observations += row.observations;
      meteredObservations += row.metered_observations;
    }
    return { available: true, accounts: rows.length, observations, meteredObservations, exactReplayDeduplicated: true,
      lateObservationRetained: true, conflictingReplayExcluded: true };
  }

  return { energy, seed, verifyRefresh, measure, reconcile };
}
