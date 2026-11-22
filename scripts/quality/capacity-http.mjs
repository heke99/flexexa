import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { enduranceStorageGuard } from './capacity-endurance.mjs';
import { measureEndurancePlans } from './capacity-endurance-plans.mjs';
import { capacityHttpProbe } from './capacity-http-profile.mjs';
import { capacityIdentity } from './capacity-identity.mjs';
import { grantMixedPartnerScope, measureMixedReads, seedMixedRoutes } from './capacity-mixed-routes.mjs';
import { profile, vehicleRows } from './capacity-profile.mjs';
import { seedRoamingCosts } from './capacity-roaming-routes.mjs';
import { percentile } from './capacity-timings.mjs';
import { telemetryFixture } from './capacity-telemetry.mjs';

const issuer = 'https://capacity-auth.invalid/auth/v1';
const normalRate = profile.load.normal.apiRequestsPerSecond;
const peakRate = profile.load.peak.apiRequestsPerSecond;
const { values } = parseArgs({ options: {
  charging: { type: 'string' },
  python: { type: 'string', default: 'python3' },
  seconds: { type: 'string', default: '5' },
  'legacy-list': { type: 'boolean' },
  telemetry: { type: 'boolean' },
  'metered-observations': { type: 'boolean' },
  'skip-reconnect': { type: 'boolean' },
  scenario: { type: 'string' },
  'profile-http': { type: 'boolean' },
  phase: { type: 'string', default: 'all' },
  'peak-seconds': { type: 'string' },
  'mixed-routes': { type: 'boolean' },
  'roaming-cost-routes': { type: 'boolean' },
  'split-pools': { type: 'boolean' },
  'endurance-seconds': { type: 'string' },
  'endurance-plan-interval-seconds': { type: 'string' },
  'fixture-token-seconds': { type: 'string' },
  'scratch-dir': { type: 'string' },
} });
assert.ok(values.charging, 'Supply --charging with the path to the charging-subscription checkout');
assert.ok(!values['skip-reconnect'] || values.telemetry, '--skip-reconnect requires --telemetry');
assert.ok(!values['metered-observations'] || values.telemetry, '--metered-observations requires --telemetry');
assert.ok(!values['mixed-routes'] || !values['legacy-list'], '--mixed-routes requires paginated routes');
assert.ok(!values['roaming-cost-routes'] || values['mixed-routes'], '--roaming-cost-routes requires --mixed-routes');
assert.ok(!values['split-pools'] || values.telemetry, '--split-pools requires --telemetry');
assert.ok(values.scenario === undefined || ['distributed', 'concentrated'].includes(values.scenario),
  '--scenario must be distributed or concentrated');
assert.ok(['all', 'normal', 'peak', 'reconnect', 'endurance'].includes(values.phase),
  '--phase must be all, normal, peak, reconnect, or endurance');
assert.ok(values.phase !== 'reconnect' || (values.telemetry && !values['skip-reconnect']),
  '--phase reconnect requires --telemetry');
const seconds = Number(values.seconds);
assert.ok(Number.isInteger(seconds) && seconds >= 1 && seconds <= 30, '--seconds must be an integer from 1 to 30');
const peakSeconds = Number(values['peak-seconds'] ?? seconds);
assert.ok(Number.isInteger(peakSeconds) && peakSeconds >= 1 && peakSeconds <= profile.load.peak.durationSeconds,
  `--peak-seconds must be an integer from 1 to ${profile.load.peak.durationSeconds}`);
const hasPhase = name => values.phase === 'all' || values.phase === name;
const endurance = values.phase === 'endurance';
const enduranceSeconds = Number(values['endurance-seconds']);
const endurancePlanInterval = values['endurance-plan-interval-seconds'] === undefined
  ? null : Number(values['endurance-plan-interval-seconds']);
const tokenLifetime = Number(values['fixture-token-seconds'] ?? '3600');
assert.ok(endurance || (values['endurance-seconds'] === undefined && values['fixture-token-seconds'] === undefined),
  '--endurance-seconds and --fixture-token-seconds require --phase endurance');
assert.ok(endurancePlanInterval === null || (endurance && Number.isInteger(endurancePlanInterval)
  && endurancePlanInterval >= 3 && endurancePlanInterval <= enduranceSeconds),
  '--endurance-plan-interval-seconds requires --phase endurance and an integer from 3 to the duration of the phase');
if (endurance) {
  assert.ok(values.scenario && values['mixed-routes'] && values.telemetry,
    '--phase endurance requires explicit --scenario, --mixed-routes and --telemetry');
  assert.ok(Number.isInteger(enduranceSeconds) && enduranceSeconds >= 1
    && enduranceSeconds <= profile.load.enduranceSeconds, 'Invalid explicit endurance duration');
  assert.ok(Number.isInteger(tokenLifetime) && tokenLifetime >= 5 && tokenLifetime <= 3_600, 'Invalid fixture token lifetime');
}
const scratchDir = resolve(values['scratch-dir'] ?? tmpdir());
const checkout = resolve(values.charging);
const localRequire = createRequire(join(checkout, 'package.json'));
const importFile = path => import(pathToFileURL(path).href);
const [embedded, database, serviceModule, httpModule, authModule, fleetWorker] = await Promise.all([
  importFile(localRequire.resolve('embedded-postgres')),
  importFile(join(checkout, 'src/db.mjs')),
  importFile(join(checkout, 'src/service.mjs')),
  importFile(join(checkout, 'src/http.mjs')),
  importFile(join(checkout, 'src/auth.mjs')),
  importFile(join(checkout, 'src/fleet-plan-worker.mjs')),
]);
const { Database, postgresPool } = database;
const { Service } = serviceModule;
const { server } = httpModule;
const { SupabaseAuth } = authModule;
const { runFleetPlanJob, solveFleet } = fleetWorker;
const partnerModule = values['mixed-routes'] ? await importFile(join(checkout, 'src/partner-energy.mjs')) : null;
const roamingModules = values['roaming-cost-routes'] ? {
  ...await importFile(join(checkout, 'src/charging-evidence.mjs')),
  ...await importFile(join(checkout, 'src/roaming-cost-close.mjs')),
} : null;
const telemetryModules = values.telemetry ? {
  ...await importFile(join(checkout, 'src/energy-service.mjs')),
  ...await importFile(join(checkout, 'src/energy-device-adapter.mjs')),
} : null;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
const [numpyVersion, ortoolsVersion] = execFileSync(values.python,
  ['-c', 'import numpy, ortools; print(numpy.__version__, ortools.__version__)'], { encoding: 'utf8' }).trim().split(' ');
const migrations = (await readdir(join(checkout, 'database'))).filter(name => /^\d+.*\.sql$/u.test(name)).sort();
assert.ok(!roamingModules || migrations.includes('054-roaming-cost-vehicle-groups.sql'),
  'Roaming cost load requires migration 054');
const applicationFiles = ['src/service.mjs', 'src/read-model.mjs', ...migrations.map(name => `database/${name}`)];
if (values.telemetry) applicationFiles.push('src/energy-service.mjs', 'src/energy-device-adapter.mjs');
if (partnerModule) applicationFiles.push('src/partner-energy.mjs', 'src/product-access.mjs', 'src/http.mjs');
if (roamingModules) applicationFiles.push('src/charging-evidence.mjs', 'src/roaming-cost-close.mjs',
  'src/company-roaming-costs.mjs', 'src/roaming-cost-vehicle-groups.mjs');
if (endurancePlanInterval !== null) applicationFiles.push('src/fleet-plan-worker.mjs', 'workers/fleet-planner/solver.py');
const digest = createHash('sha256');
for (const name of applicationFiles) digest.update(name).update('\0').update(await readFile(join(checkout, name)));
const implementationSha256 = digest.digest('hex');

async function bindLoopback(listener) {
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return listener.address().port;
}

function close(listener) {
  return new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
}

async function freshCluster() {
  const socket = createServer();
  const port = await bindLoopback(socket);
  await close(socket);
  const directory = await mkdtemp(join(scratchDir, 'flexexa-capacity-pg-'));
  const password = randomUUID();
  const cluster = new embedded.default({
    databaseDir: join(directory, 'data'),
    user: 'postgres',
    password,
    port,
    persistent: true,
    postgresFlags: ['-c', 'listen_addresses=127.0.0.1'],
    onLog() {},
    onError() {},
  });
  let started = false;
  try {
    await cluster.initialise();
    await cluster.start();
    started = true;
    return {
      async database(name) {
        await cluster.createDatabase(name);
        const connection = `postgres://postgres:${password}@127.0.0.1:${port}/${name}`;
        const pool = postgresPool(connection);
        let telemetryPool;
        if (values['split-pools']) {
          pool.options.max = 6;
          telemetryPool = postgresPool(connection);
          telemetryPool.options.max = 4;
        }
        return { pool, telemetryPool };
      },
      async close() {
        try { await cluster.stop(); } finally { await rm(directory, { recursive: true, force: true }); }
      },
    };
  } catch (error) {
    if (started) await cluster.stop();
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function seed(pool, fixture, issueCredential) {
  const tenantIds = [...new Set(fixture.map(vehicle => vehicle.tenantId))];
  const tenants = new Map();
  for (const name of [...tenantIds, 'control-1', 'control-2']) {
    const id = randomUUID();
    tenants.set(name, { id, vehicleIds: [], vehicleSet: new Set(), plates: [] });
    await pool.query("INSERT INTO charging_subscription.accounts(id,kind,name) VALUES($1,'business',$2)", [id, name]);
    if (name !== 'control-2') await pool.query(`
      INSERT INTO charging_subscription.product_access(account_id,product_key,status,version,approved_by,reason)
      VALUES ($1,'energy_optimization','active',1,gen_random_uuid(),'Native capacity fixture'),
             ($1,'external_api','active',1,gen_random_uuid(),'Native capacity fixture')
    `, [id]);
  }
  const allVehicles = [...fixture, ...['control-1', 'control-2'].map((tenantId, index) => ({
    tenantId, vehicleId: `control-car-${index + 1}`,
  }))];
  const ids = allVehicles.map(() => randomUUID());
  const plates = allVehicles.map((_, index) => `CAP${String(index + 1).padStart(6, '0')}`);
  const testVehicleIds = new Map();
  const accounts = allVehicles.map((vehicle, index) => {
    const tenant = tenants.get(vehicle.tenantId);
    tenant.vehicleIds.push(ids[index]);
    tenant.vehicleSet.add(ids[index]);
    tenant.plates.push(plates[index]);
    testVehicleIds.set(vehicle.vehicleId, ids[index]);
    return tenant.id;
  });
  await pool.query(`
    INSERT INTO charging_subscription.vehicles(id,account_id,country,plate)
    SELECT id, account, 'SE', plate FROM unnest($1::uuid[],$2::uuid[],$3::text[]) AS fixture(id,account,plate)
  `, [ids, accounts, plates]);
  await pool.query('ANALYZE charging_subscription.vehicles');

  async function actor(tenant, role) {
    const principal = randomUUID();
    const subject = randomUUID();
    await pool.query('INSERT INTO charging_subscription.principals(id) VALUES($1)', [principal]);
    await pool.query('INSERT INTO charging_subscription.identities(issuer,subject,principal_id) VALUES($1,$2,$3)',
      [issuer, subject, principal]);
    await pool.query('INSERT INTO charging_subscription.memberships VALUES($1,$2,$3)', [tenant.id, principal, role]);
    const token = issueCredential(subject);
    return { get token() { return token(); }, tenant, principal, role };
  }

  const fleet = tenantIds.map(name => tenants.get(name));
  const owners = new Map();
  for (const name of tenantIds) owners.set(name, await actor(tenants.get(name), 'owner'));
  const control = await actor(tenants.get('control-1'), 'owner');
  const subscriptionOnly = await actor(tenants.get('control-2'), 'owner');
  const driver = await actor(fleet[0], 'driver');
  await pool.query("INSERT INTO charging_subscription.memberships VALUES($1,$2,'driver')",
    [control.tenant.id, driver.principal]);
  const subscription = randomUUID();
  for (const [id, tenant] of [[subscription, driver.tenant], [randomUUID(), control.tenant]]) {
    await pool.query(`
      INSERT INTO charging_subscription.subscriptions(id,account_id,vehicle_id,contract,billing,starts_at,ends_at)
      VALUES($1,$2,$3,'active','paid',now()-interval '1 day',now()+interval '1 day')
    `, [id, tenant.id, tenant.vehicleIds[0]]);
    await pool.query('INSERT INTO charging_subscription.driver_grants VALUES($1,$2,$3)', [tenant.id, driver.principal, id]);
  }
  const loadActors = [];
  const requestedPerMinute = endurance ? normalRate * Math.min(60, enduranceSeconds)
    : normalRate * Math.min(60, seconds) + peakRate * Math.min(60, peakSeconds);
  const totalActors = Math.ceil(requestedPerMinute / 90) + 12;
  for (let index = 0; index < totalActors; index += 1) {
    loadActors.push(await actor(fleet[index % fleet.length], index % 2 === 0 ? 'owner' : 'billing'));
  }
  const controls = { cursorActors: [], financeDrivers: [] };
  if (values['mixed-routes']) {
    for (let index = 0; index < 16; index += 1) {
      controls.cursorActors.push(await actor(control.tenant, 'owner'));
      controls.financeDrivers.push(await actor(driver.tenant, 'driver'));
    }
  }
  const roamingBillers = [];
  if (values['roaming-cost-routes']) {
    for (const tenant of fleet) roamingBillers.push(await actor(tenant, 'billing'));
  }
  return { owners, control, subscriptionOnly, driver, subscription, loadActors, testVehicleIds, roamingBillers, ...controls };
}

function authenticationFixture() {
  const identity = capacityIdentity({ issuer, lifetimeSeconds: tokenLifetime, renew: endurance });
  const auth = new SupabaseAuth({
    url: 'https://capacity-auth.invalid',
    publishableKey: 'capacity-fixture',
    fetcher: async (url, options) => {
      assert.equal(url, issuer + '/user');
      const token = options.headers.Authorization.slice('Bearer '.length);
      const user = identity.user(token);
      return user ? Response.json(user) : new Response(null, { status: 401 });
    },
  });
  return { auth, ...identity };
}

function createRequest(origin) {
  return async function request(actor, resource, { account = actor.tenant.id, method = 'GET', body, key, partnerProof } = {}) {
    const path = resource.startsWith('/v1/') ? resource : `/v1/accounts/${account}/${resource}`;
    const response = await fetch(origin + path, {
      method,
      headers: {
        authorization: `Bearer ${actor.token}`,
        ...(partnerProof ? { 'x-flexexa-partner-authorization': `Bearer ${partnerProof}` } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json', 'idempotency-key': key } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    const raw = await response.text();
    return { status: response.status, body: JSON.parse(raw), bytes: Buffer.byteLength(raw) };
  };
}

async function verifyVehicleAccess(request, fixtures, db) {
  const { owners, loadActors } = fixtures;
  let pages = 0;
  for (const actor of owners.values()) {
    const legacy = await request(actor, 'vehicles');
    assert.equal(legacy.status, 200);
    assert.deepEqual(Object.keys(legacy.body), ['items']);
    assert.deepEqual(legacy.body.items.map(row => row.id), actor.tenant.vehicleIds);
    if (values['legacy-list']) continue;
    const gathered = [];
    const alternates = [actor, ...loadActors.filter(item => item.tenant.id === actor.tenant.id)];
    let cursor = null;
    do {
      const reader = alternates[pages % alternates.length];
      const suffix = cursor ? `&after=${encodeURIComponent(cursor)}` : '';
      const result = await request(reader, `vehicles?limit=100${suffix}`);
      assert.equal(result.status, 200);
      assert.ok(result.body.items.length <= 100);
      gathered.push(...result.body.items.map(row => row.id));
      cursor = result.body.nextCursor;
      if (values['mixed-routes'] && gathered.length === Math.floor(actor.tenant.vehicleIds.length / 200) * 100) {
        assert.ok(cursor, 'Expected a midpoint cursor for the capacity fixture');
        actor.tenant.fixturePage = { after: cursor, offset: gathered.length };
      }
      pages += 1;
    } while (cursor);
    assert.deepEqual(gathered, actor.tenant.vehicleIds);
  }
  await db.transaction('api', async client => {
    const { rows: [row] } = await client.query('SELECT current_user AS role,(SELECT count(*)::int FROM charging_subscription.vehicles) AS count');
    assert.deepEqual(row, { role: 'charging_api', count: 0 });
  });
  return { fleetTenants: owners.size, correctLegacyLists: owners.size, pages };
}

async function verifyDriverRevocation(request, fixtures) {
  const { owners, control, driver, subscription } = fixtures;
  const owner = owners.values().next().value;
  // Check access changes while the normal-rate read sample is active.
  await delay(seconds * 250);
  const route = values['legacy-list'] ? 'vehicles' : 'vehicles?limit=100';
  assert.equal((await request(control, route, { account: owner.tenant.id })).status, 403);
  assert.equal((await request(owner, route, { account: control.tenant.id })).status, 403);
  assert.deepEqual((await request(driver, route)).body.items.map(row => row.id), [owner.tenant.vehicleIds[0]]);
  assert.equal((await request({ ...driver, token: 'invalid-test-token-that-is-not-recognized' }, route)).status, 401);
  const revoked = await request(owner, `subscriptions/${subscription}/revoke-driver`, {
    method: 'POST', body: JSON.stringify({ principalId: driver.principal }), key: 'capacity-driver-revocation',
  });
  assert.equal(revoked.status, 200);
  assert.deepEqual((await request(driver, route)).body.items, []);
  assert.deepEqual((await request(driver, route, { account: control.tenant.id })).body.items.map(row => row.id),
    control.tenant.vehicleIds);

  if (!values['legacy-list']) {
    const { body } = await request(owner, 'vehicles?limit=1');
    assert.ok(body.nextCursor);
    assert.equal((await request(control, `vehicles?after=${body.nextCursor}`)).status, 400);
    assert.equal((await request(driver, `vehicles?after=${body.nextCursor}`)).status, 400);
  }
  return { driverGrantRevoked: true, controlTenantRetained: true };
}

async function measureReads(request, fixtures, rate, duration = seconds) {
  const route = values['legacy-list'] ? 'vehicles' : 'vehicles?limit=100';
  const attempts = rate * duration;
  const latencies = [];
  const dispatchDelays = [];
  const responseLatencies = [];
  const statuses = {};
  const pending = new Set();
  let bytes = 0;
  let wrongRows = 0;
  let dropped = 0;
  let maxInFlight = 0;
  const start = performance.now();
  for (let index = 0; index < attempts; index += 1) {
    const scheduled = start + index * 1000 / rate;
    const wait = scheduled - performance.now();
    if (wait > 0) await delay(wait);
    if (pending.size >= 400) {
      dropped += 1;
      continue;
    }
    const actor = fixtures.loadActors[index % fixtures.loadActors.length];
    const dispatched = performance.now();
    dispatchDelays.push(dispatched - scheduled);
    const operation = request(actor, route).then(result => {
      const status = String(result.status);
      statuses[status] = (statuses[status] ?? 0) + 1;
      if (result.status !== 200) return;
      const completed = performance.now();
      latencies.push(completed - scheduled);
      responseLatencies.push(completed - dispatched);
      bytes += result.bytes;
      const expected = values['legacy-list'] ? actor.tenant.vehicleIds.length : 100;
      if (result.body.items?.length !== expected || result.body.items.some(row => !actor.tenant.vehicleSet.has(row.id))) {
        wrongRows += 1;
      }
    }).catch(() => { statuses.error = (statuses.error ?? 0) + 1; })
      .finally(() => pending.delete(operation));
    pending.add(operation);
    maxInFlight = Math.max(maxInFlight, pending.size);
  }
  const scheduleElapsed = performance.now() - start;
  await Promise.all(pending);
  const observedSeconds = (performance.now() - start) / 1_000;
  assert.equal(wrongRows, 0, 'A successful response contained unexpected or cross-tenant rows');
  const p95Ms = percentile(latencies, 0.95);
  const unexpectedErrorRatio = (attempts - (statuses['200'] ?? 0)) / attempts;
  return {
    route: `GET /v1/accounts/:account/${route}`,
    offeredRequestsPerSecond: rate, scheduledSeconds: duration, requests: attempts, statuses, dropped, wrongRows,
    observedSeconds: Number(observedSeconds.toFixed(3)), scheduleMilliseconds: Math.round(scheduleElapsed), maxInFlight,
    p95Ms, p99Ms: percentile(latencies, 0.99), unexpectedErrorRatio, bytes,
    dispatchDelayP95Ms: percentile(dispatchDelays, 0.95), sentToReadP95Ms: percentile(responseLatencies, 0.95),
    withinProposedThresholds: p95Ms !== null && p95Ms <= profile.thresholds.criticalReadP95Ms
      && unexpectedErrorRatio <= profile.thresholds.criticalReadUnexpectedErrorRatioMax,
  };
}

function planningBodies(vehicles, ids) {
  const byTenant = new Map();
  for (const [index, vehicle] of vehicles.entries()) {
    if (!byTenant.has(vehicle.tenantId)) byTenant.set(vehicle.tenantId, new Map());
    const bySite = byTenant.get(vehicle.tenantId);
    if (!bySite.has(vehicle.siteId)) bySite.set(vehicle.siteId, []);
    bySite.get(vehicle.siteId).push({
      id: ids.get(vehicle.vehicleId), required_wh: 6_000 + index % 4_000, max_wh_per_slot: 2_750,
      first_slot: index % 24, end_slot: 72 + index % 25, priority: index % 3 + 1, mode: 'smart',
    });
  }
  return [...byTenant].map(([tenant, sites]) => [tenant, {
    series: 'capacity-lab',
    priceBasis: 'including_vat',
    startsAt: '2026-11-22T00:00:00Z',
    problem: { sites: [...sites].map(([id, assets]) => ({
      id, assets, slots: Array.from({ length: 96 }, (_, quarter) => ({
        available_wh: assets.length * 320, price_sek_per_kwh: quarter < 24 ? -0.10 : (quarter % 12) / 10,
      })),
    })) },
  }]);
}

async function verifyPlanning(request, fixtures, db, vehicles) {
  const jobs = await Promise.all(planningBodies(vehicles, fixtures.testVehicleIds).map(async ([tenant, body]) => {
    const actor = fixtures.owners.get(tenant);
    const raw = JSON.stringify(body);
    const start = performance.now();
    const response = await request(actor, 'energy-plans', { method: 'POST', body: raw, key: 'capacity-fleet-create' });
    const admissionMs = performance.now() - start;
    assert.equal(response.status, 202, JSON.stringify(response.body));
    const path = `energy-plans/${response.body.id}`;
    assert.equal((await request(actor, path)).body.status, 'queued');
    return { actor, path, body, raw, admissionMs, id: response.body.id,
      expectedResources: body.problem.sites.reduce((sum, site) => sum + site.assets.length, 0) };
  }));
  const first = jobs[0];
  const replay = await request(first.actor, 'energy-plans', { method: 'POST', body: first.raw, key: 'capacity-fleet-create' });
  assert.equal(replay.body.id, first.id);
  assert.equal((await request(fixtures.control, first.path)).status, 404);
  assert.equal((await request(fixtures.control, first.path, { account: first.actor.tenant.id })).status, 403);
  const admission = { method: 'POST', body: first.raw, key: 'capacity-fleet-deny' };
  assert.equal((await request(fixtures.subscriptionOnly, 'energy-plans', admission)).status, 403);
  assert.equal((await request(fixtures.driver, 'energy-plans', admission)).status, 403);
  const replacement = await request(first.actor, 'energy-plans', {
    method: 'POST', body: JSON.stringify({ ...first.body, priceBasis: 'excluding_vat' }), key: 'capacity-fleet-replan',
  });
  assert.equal(replacement.status, 202);
  assert.equal((await request(first.actor, first.path)).body.status, 'superseded');
  const expectedJobs = new Set(jobs.map(job => job.id));
  expectedJobs.delete(first.id);
  expectedJobs.add(replacement.body.id);
  const startWork = performance.now();
  for (let index = 0; index < jobs.length; index += 1) {
    const processed = await runFleetPlanJob(db, { solve: problem => solveFleet(problem, { python: values.python }) });
    assert.equal(processed.status, 'completed');
    assert.ok(expectedJobs.delete(processed.id));
  }
  const workerMs = Math.round(performance.now() - startWork);
  assert.equal(expectedJobs.size, 0);
  let solvedResources = 0;
  for (const [index, job] of jobs.entries()) {
    const path = index === 0 ? `energy-plans/${replacement.body.id}` : job.path;
    const result = await request(job.actor, path);
    assert.equal(result.status, 200);
    assert.equal(result.body.status, 'completed');
    assert.equal(result.body.result.execution, 'not_dispatched');
    assert.equal(result.body.result.dispatch_ready, false);
    const count = Object.keys(result.body.result.unmet_wh).length;
    assert.equal(count, job.expectedResources);
    solvedResources += count;
  }
  assert.equal(solvedResources, vehicles.length);
  return { jobs: jobs.length, solvedResources, workerMs, supersededJobs: 1,
    sampledDoorToDurableAckP95Ms: percentile(jobs.map(job => job.admissionMs), 0.95) };
}

async function scenario(cluster, name) {
  const { pool, telemetryPool } = await cluster.database(`capacity_${name}`);
  const pools = telemetryPool ? [pool, telemetryPool] : [pool];
  const liveConnections = new Set();
  const poolErrors = [];
  for (const currentPool of pools) {
    currentPool.on('connect', client => {
      const closed = new Promise(resolve => client.once('end', resolve));
      liveConnections.add(closed);
      void closed.then(() => liveConnections.delete(closed));
    });
    currentPool.on('error', error => poolErrors.push(error.code ?? 'POOL_ERROR'));
  }
  let listener;
  const startedAtUtc = new Date().toISOString();
  try {
    const databaseVersion = (await pool.query('SHOW server_version')).rows[0].server_version;
    for (const migration of migrations) await pool.query(await readFile(join(checkout, 'database', migration), 'utf8'));
    const probe = values['profile-http'] ? capacityHttpProbe(pool, telemetryPool) : null;
    const db = new Database(probe?.pool ?? pool);
    const telemetryDb = telemetryPool ? new Database(probe?.telemetryPool ?? telemetryPool) : db;
    const service = new Service(db);
    const vehicles = [...vehicleRows(name)];
    const { auth, credential, stats } = authenticationFixture();
    const fixtures = await seed(pool, vehicles, credential);
    const mixed = partnerModule ? await seedMixedRoutes(pool, db, fixtures, { issuer, issueCredential: credential }) : null;
    if (roamingModules) mixed.roamingCosts = await seedRoamingCosts(db, fixtures.owners, roamingModules);
    const partnerEnergy = partnerModule ? new partnerModule.PartnerEnergyService(service, null) : null;
    probe?.wrap(service, db, partnerEnergy, telemetryDb);
    const telemetry = values.telemetry ? telemetryFixture(telemetryModules, db, service, {
      metered: values['metered-observations'], telemetryDb,
    }) : null;
    if (telemetry) await telemetry.seed(pool, vehicles, fixtures);
    listener = server({ service, auth, fleetPlanningEnabled: true, energy: telemetry?.energy, partnerEnergy });
    const port = await bindLoopback(listener);
    const request = createRequest(`http://127.0.0.1:${port}`);
    if (mixed) await grantMixedPartnerScope(request, mixed,
      endurance ? Math.max(86_400, enduranceSeconds + 3_600) : undefined);
    const access = await verifyVehicleAccess(request, fixtures, db);
    const explain = await probe?.explain(db, auth, fixtures.owners.values().next().value);
    const refresh = await telemetry?.verifyRefresh(request, fixtures);
    const readSamples = [];
    const telemetrySamples = [];
    const profiles = {};
    let driverRevocation, planner, enduranceEvidence;
    const read = mixed
      ? (rate, duration, options) => measureMixedReads(request, { ...fixtures, ...mixed }, rate, duration, options)
      : (rate, duration) => measureReads(request, fixtures, rate, duration);
    if (hasPhase('normal')) {
      probe?.start();
      const normal = await Promise.allSettled([
        read(normalRate, seconds),
        verifyPlanning(request, fixtures, db, vehicles),
        verifyDriverRevocation(request, fixtures),
        telemetry?.measure('normal', seconds),
      ]);
      profiles.normal = probe?.stop();
      for (const result of normal) if (result.status === 'rejected') throw result.reason;
      readSamples.push(normal[0].value);
      planner = normal[1].value;
      driverRevocation = normal[2].value;
      if (telemetry) telemetrySamples.push(normal[3].value);
    }
    if (hasPhase('peak')) {
      probe?.start();
      const peak = await Promise.allSettled([
        read(peakRate, peakSeconds),
        telemetry?.measure('peak', peakSeconds),
      ]);
      profiles.peak = probe?.stop();
      for (const result of peak) if (result.status === 'rejected') throw result.reason;
      readSamples.push(peak[0].value);
      if (telemetry) telemetrySamples.push(peak[1].value);
    }
    if (telemetry && !values['skip-reconnect'] && hasPhase('reconnect')) {
      telemetrySamples.push(await telemetry.measure('reconnect', profile.load.reconnect.durationSeconds));
    }
    if (endurance) {
      const guard = await enduranceStorageGuard(scratchDir);
      const options = { bounded: true, signal: guard.signal };
      let result;
      probe?.start();
      try {
        result = await Promise.allSettled([
          read(normalRate, enduranceSeconds, options),
          telemetry.measure('normal', enduranceSeconds, options),
          ...(endurancePlanInterval === null ? [] : [measureEndurancePlans({
            request, fixtures, vehicles, db, runFleetPlanJob, solve: problem => solveFleet(problem, { python: values.python }),
            durationSeconds: enduranceSeconds, intervalSeconds: endurancePlanInterval, signal: guard.signal,
          })]),
        ]);
      } finally {
        profiles.endurance = probe?.stop();
        enduranceEvidence = { storage: guard.stop() };
      }
      for (const completed of result) if (completed.status === 'rejected') throw completed.reason;
      const [httpLoad, telemetryLoad, planWorkload] = result.map(completed => completed.value);
      readSamples.push(httpLoad);
      telemetrySamples.push(telemetryLoad);
      enduranceEvidence.scheduleCompleted = !guard.signal.aborted
        && httpLoad.requests === httpLoad.plannedRequests && telemetryLoad.scheduled === telemetryLoad.planned;
      if (planWorkload) enduranceEvidence.planWorkload = planWorkload;
    }
    const reconciliation = await telemetry?.reconcile(request, fixtures, { streaming: endurance });
    if (endurance) {
      const { rows: [footprint] } = await pool.query(`
        SELECT (SELECT count(*)::int FROM charging_subscription.app_sessions) AS sessions,
          pg_total_relation_size(to_regclass('charging_subscription.simulated_energy_telemetry')) AS telemetry_bytes
      `);
      enduranceEvidence.identity = { ...stats(), storedSessions: footprint.sessions, syntheticTokenLifetimeSeconds: tokenLifetime };
      enduranceEvidence.telemetryRelationBytes = footprint.telemetry_bytes === null ? null : Number(footprint.telemetry_bytes);
    }
    assert.deepEqual(poolErrors, []);
    console.log(JSON.stringify({
      scope: 'local_loopback_native_postgres', scenario: name, phase: values.phase,
      revision, implementationSha256, numpyVersion, ortoolsVersion,
      databaseVersion, nodeVersion: process.version, migrationsReplayed: migrations.length, startedAtUtc,
      connectionPools: telemetryPool ? { api: pool.options.max, telemetry: telemetryPool.options.max }
        : { shared: pool.options.max },
      finishedAtUtc: new Date().toISOString(), fixtureVehicles: vehicles.length, controlVehicles: 2,
      vehicleAccess: { ...access, ...driverRevocation }, readSamples, planner,
      ...(mixed ? { mixedRoutes: { privateAccounts: mixed.privateCustomers.length,
        privateFixtureVehicles: mixed.privateCustomers.length * 2,
        ...(mixed.roamingCosts ? { roamingCosts: mixed.roamingCosts } : {}) } } : {}),
      ...(endurance ? { endurance: enduranceEvidence } : {}),
      ...(telemetry ? { telemetry: { refresh, samples: telemetrySamples, reconciliation } } : {}),
      ...(probe ? { profiling: { explain, ...profiles } } : {}),
    }));
    assert.ok(!mixed || readSamples.every(sample => sample.routeSamples.every(route =>
      route.wrongPayload === 0 && route.unauthorizedSuccess === 0)),
    'A mixed route delivered an unexpected payload or authorized a denied request');
    if (endurance && !enduranceEvidence.scheduleCompleted) process.exitCode = 2;
    if (enduranceEvidence?.planWorkload && !enduranceEvidence.planWorkload.allIntervalsCompleted) process.exitCode = 2;
  } finally {
    if (listener) await close(listener);
    await Promise.all(pools.map(currentPool => currentPool.end()));
    await Promise.all(liveConnections);
  }
}

for (const name of values.scenario ? [values.scenario] : ['distributed', 'concentrated']) {
  const cluster = await freshCluster();
  try {
    await scenario(cluster, name);
  } finally {
    await cluster.close();
  }
}
