import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { capacityTimings } from './capacity-timings.mjs';

const quarterMs = 900_000;
const series = 'capacity-endurance-replan';

function planningSites(vehicles, fixtures) {
  const sites = new Map();
  for (const vehicle of vehicles) {
    if (!sites.has(vehicle.tenantId)) sites.set(vehicle.tenantId, { id: vehicle.siteId, assets: [] });
    const site = sites.get(vehicle.tenantId);
    if (vehicle.siteId === site.id && site.assets.length < 24) {
      site.assets.push(fixtures.testVehicleIds.get(vehicle.vehicleId));
    }
  }
  return [...sites].map(([tenant, site]) => ({ actor: fixtures.owners.get(tenant), site }));
}

function submission(site, iteration) {
  const shift = iteration % 4;
  return {
    series, priceBasis: 'excluding_vat', startsAt: new Date(Math.ceil(Date.now() / quarterMs) * quarterMs).toISOString(),
    problem: { sites: [{ id: site.id,
      slots: Array.from({ length: 96 }, (_, slot) => ({
        available_wh: 18_000, price_sek_per_kwh: ((slot + shift * 4) % 24 - 3) / 10,
      })),
      assets: site.assets.map((id, position) => ({ id, required_wh: 4_000 + position * 150,
        max_wh_per_slot: 2_750, first_slot: position % 12, end_slot: 36 + position % 12 + shift,
        priority: position % 3 + 1, mode: 'smart' })),
    }] },
  };
}

function reconciledAllocation(result, site) {
  assert.equal(result.dispatch_ready, false);
  assert.equal(result.execution, 'not_dispatched');
  const assets = new Map(site.assets.map(asset => [asset.id, asset]));
  const perVehicle = new Map(), perSlot = new Map(), allocatedPairs = new Set();
  assert.deepEqual(Object.keys(result.unmet_wh).sort(), [...assets.keys()].sort());
  for (const row of result.allocations) {
    const asset = assets.get(row.asset_id);
    assert.ok(asset);
    assert.ok(Number.isSafeInteger(row.slot) && row.slot >= asset.first_slot && row.slot < asset.end_slot);
    assert.ok(Number.isSafeInteger(row.wh) && row.wh > 0 && row.wh <= asset.max_wh_per_slot);
    const pair = `${row.asset_id}:${row.slot}`;
    assert.ok(!allocatedPairs.has(pair));
    allocatedPairs.add(pair);
    perVehicle.set(row.asset_id, (perVehicle.get(row.asset_id) ?? 0) + row.wh);
    perSlot.set(row.slot, (perSlot.get(row.slot) ?? 0) + row.wh);
  }
  for (const [slot, wh] of perSlot) assert.ok(wh <= site.slots[slot].available_wh);
  let energy = 0;
  for (const [id, spec] of assets) {
    assert.equal(result.unmet_wh[id], 0);
    assert.equal(perVehicle.get(id), spec.required_wh);
    energy += spec.required_wh;
  }
  assert.equal(result.allocated_wh, energy);
  assert.deepEqual(result.sites, [{ id: site.id, allocated_wh: energy, unmet_wh: 0 }]);
  return energy;
}

export async function measureEndurancePlans({ request, fixtures, vehicles, db, runFleetPlanJob, solve,
  durationSeconds, intervalSeconds, signal }) {
  const companies = planningSites(vehicles, fixtures);
  const admission = capacityTimings(true), worker = capacityTimings(true);
  const precedingJobs = new Map();
  const plannedIntervals = Math.ceil(durationSeconds / intervalSeconds);
  const intervalMs = intervalSeconds * 1_000;
  const started = performance.now();
  let submitted = 0, completed = 0, missedIntervals = 0, superseded = 0;
  let reconciledVehiclePlans = 0, reconciledEnergyWh = 0, failedStage = null;

  for (let iteration = 0; iteration < plannedIntervals && !signal.aborted; iteration += 1) {
    const scheduled = started + iteration * intervalMs;
    const wait = scheduled - performance.now();
    if (wait > 0) await delay(wait, undefined, { signal }).catch(error => {
      if (error.name !== 'AbortError') throw error;
    });
    if (signal.aborted) break;
    if (performance.now() >= Math.min(started + durationSeconds * 1_000, scheduled + intervalMs)) {
      missedIntervals += 1;
      continue;
    }
    const companyIndex = iteration % companies.length;
    const { actor, site } = companies[companyIndex];
    const body = submission(site, companyIndex + Math.floor(iteration / companies.length));
    let stage = 'admission';
    try {
      const sentAt = performance.now();
      const response = await request(actor, 'energy-plans', { method: 'POST', body: JSON.stringify(body),
        key: `capacity-endurance-plan-${iteration}` });
      assert.equal(response.status, 202);
      assert.equal(typeof response.body.id, 'string');
      const id = response.body.id, path = `energy-plans/${id}`;
      submitted += 1;
      admission.add(performance.now() - sentAt);
      stage = 'durable_queue';
      const queued = await request(actor, path);
      assert.equal(queued.status, 200);
      assert.equal(queued.body.status, 'queued');
      assert.equal(queued.body.result, null);
      const previous = precedingJobs.get(actor.tenant.id);
      if (previous) {
        stage = 'supersession';
        const replaced = await request(actor, `energy-plans/${previous}`);
        assert.equal(replaced.status, 200);
        assert.equal(replaced.body.status, 'superseded');
        assert.equal(replaced.body.result, null);
        superseded += 1;
      }
      stage = 'worker';
      const workerAt = performance.now();
      const processed = await runFleetPlanJob(db, { solve });
      assert.deepEqual(processed, { id, status: 'completed' });
      worker.add(performance.now() - workerAt);
      stage = 'result';
      const finished = await request(actor, path);
      assert.equal(finished.status, 200);
      assert.equal(finished.body.status, 'completed');
      reconciledEnergyWh += reconciledAllocation(finished.body.result, body.problem.sites[0]);
      reconciledVehiclePlans += site.assets.length;
      precedingJobs.set(actor.tenant.id, id);
      completed += 1;
    } catch {
      failedStage = stage;
      break;
    }
  }
  return { cadenceSeconds: intervalSeconds, plannedIntervals, submitted, completed, missedIntervals, superseded,
    matchedCompanies: precedingJobs.size, reconciledVehiclePlans, reconciledEnergyWh, failedStage,
    scheduledComplete: !signal.aborted && failedStage === null && completed + missedIntervals === plannedIntervals,
    allIntervalsCompleted: completed === plannedIntervals,
    admissionP95Ms: admission.percentile(0.95), workerP95Ms: worker.percentile(0.95),
    latencyMethod: 'bounded_hdr_3_significant_figures' };
}
