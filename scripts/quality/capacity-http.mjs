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
import { profile, vehicleRows } from './capacity-profile.mjs';

const issuer = 'https://capacity-auth.invalid/auth/v1';
const normalRate = profile.load.normal.apiRequestsPerSecond;
const peakRate = profile.load.peak.apiRequestsPerSecond;
const { values } = parseArgs({ options: {
  charging: { type: 'string' },
  python: { type: 'string', default: 'python3' },
  seconds: { type: 'string', default: '5' },
  'legacy-list': { type: 'boolean' },
} });
assert.ok(values.charging, 'Supply --charging with the path to the charging-subscription checkout');
const seconds = Number(values.seconds);
assert.ok(Number.isInteger(seconds) && seconds >= 1 && seconds <= 30, '--seconds must be an integer from 1 to 30');
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
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim();
const [numpyVersion, ortoolsVersion] = execFileSync(values.python,
  ['-c', 'import numpy, ortools; print(numpy.__version__, ortools.__version__)'], { encoding: 'utf8' }).trim().split(' ');
const migrations = (await readdir(join(checkout, 'database'))).filter(name => /^\d+.*\.sql$/u.test(name)).sort();
const applicationFiles = ['src/service.mjs', 'src/read-model.mjs', ...migrations.map(name => `database/${name}`)];
const digest = createHash('sha256');
for (const name of applicationFiles) digest.update(name).update('\0').update(await readFile(join(checkout, name)));
const implementationSha256 = digest.digest('hex');

function percentile(numbers, fraction) {
  const ordered = [...numbers].sort((a, b) => a - b);
  const value = ordered[Math.ceil(fraction * ordered.length) - 1];
  return value === undefined ? null : Math.round(value * 10) / 10;
}

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
  const directory = await mkdtemp(join(tmpdir(), 'flexexa-capacity-pg-'));
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
        return postgresPool(`postgres://postgres:${password}@127.0.0.1:${port}/${name}`);
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

async function seed(pool, fixture, issueToken) {
  const tenantIds = [...new Set(fixture.map(vehicle => vehicle.tenantId))];
  const tenants = new Map();
  for (const name of [...tenantIds, 'control-1', 'control-2']) {
    const id = randomUUID();
    tenants.set(name, { id, vehicleIds: [], vehicleSet: new Set() });
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
    return { token: issueToken(subject), tenant, principal };
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
  const totalActors = Math.ceil((normalRate + peakRate) * seconds / 90) + 12;
  for (let index = 0; index < totalActors; index += 1) {
    loadActors.push(await actor(fleet[index % fleet.length], index % 2 === 0 ? 'owner' : 'billing'));
  }
  return { owners, control, subscriptionOnly, driver, subscription, loadActors, testVehicleIds };
}

function authenticationFixture() {
  const users = new Map();
  const auth = new SupabaseAuth({
    url: 'https://capacity-auth.invalid',
    publishableKey: 'capacity-fixture',
    fetcher: async (url, options) => {
      assert.equal(url, issuer + '/user');
      const token = options.headers.Authorization.slice('Bearer '.length);
      const user = users.get(token);
      return user ? Response.json(user) : new Response(null, { status: 401 });
    },
  });
  return {
    auth,
    issueToken(subject) {
      const now = Math.floor(Date.now() / 1000);
      const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
      const token = `${encode({ alg: 'HS256' })}.${encode({
        iss: issuer, sub: subject, session_id: randomUUID(), aud: 'authenticated', role: 'authenticated',
        aal: 'aal1', iat: now, exp: now + 3600, amr: [{ method: 'password', timestamp: now }],
      })}.${randomUUID()}`;
      users.set(token, { id: subject, email: `${subject}@capacity.invalid`, email_confirmed_at: new Date().toISOString() });
      return token;
    },
  };
}

function createRequest(origin) {
  return async function request(actor, resource, { account = actor.tenant.id, method = 'GET', body, key } = {}) {
    const response = await fetch(`${origin}/v1/accounts/${account}/${resource}`, {
      method,
      headers: {
        authorization: `Bearer ${actor.token}`,
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

async function measureReads(request, fixtures, rate) {
  const route = values['legacy-list'] ? 'vehicles' : 'vehicles?limit=100';
  const attempts = rate * seconds;
  const latencies = [];
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
    const operation = request(actor, route).then(result => {
      const status = String(result.status);
      statuses[status] = (statuses[status] ?? 0) + 1;
      if (result.status !== 200) return;
      latencies.push(performance.now() - scheduled);
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
    offeredRequestsPerSecond: rate, scheduledSeconds: seconds, requests: attempts, statuses, dropped, wrongRows,
    observedSeconds: Number(observedSeconds.toFixed(3)), scheduleMilliseconds: Math.round(scheduleElapsed), maxInFlight,
    p95Ms, p99Ms: percentile(latencies, 0.99), unexpectedErrorRatio, bytes,
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
  const pool = await cluster.database(`capacity_${name}`);
  const liveConnections = new Set();
  const poolErrors = [];
  pool.on('connect', client => {
    const closed = new Promise(resolve => client.once('end', resolve));
    liveConnections.add(closed);
    void closed.then(() => liveConnections.delete(closed));
  });
  pool.on('error', error => poolErrors.push(error.code ?? 'POOL_ERROR'));
  let listener;
  const startedAtUtc = new Date().toISOString();
  try {
    const databaseVersion = (await pool.query('SHOW server_version')).rows[0].server_version;
    for (const migration of migrations) await pool.query(await readFile(join(checkout, 'database', migration), 'utf8'));
    const db = new Database(pool);
    const service = new Service(db);
    const vehicles = [...vehicleRows(name)];
    const { auth, issueToken } = authenticationFixture();
    const fixtures = await seed(pool, vehicles, issueToken);
    listener = server({ service, auth, fleetPlanningEnabled: true });
    const port = await bindLoopback(listener);
    const request = createRequest(`http://127.0.0.1:${port}`);
    const access = await verifyVehicleAccess(request, fixtures, db);
    const readSamples = [];
    const concurrent = await Promise.allSettled([measureReads(request, fixtures, normalRate),
      verifyPlanning(request, fixtures, db, vehicles), verifyDriverRevocation(request, fixtures)]);
    for (const result of concurrent) if (result.status === 'rejected') throw result.reason;
    readSamples.push(concurrent[0].value);
    readSamples.push(await measureReads(request, fixtures, peakRate));
    assert.deepEqual(poolErrors, []);
    console.log(JSON.stringify({
      scope: 'local_loopback_native_postgres', scenario: name, revision, implementationSha256, numpyVersion, ortoolsVersion,
      databaseVersion, nodeVersion: process.version, migrationsReplayed: migrations.length, startedAtUtc,
      finishedAtUtc: new Date().toISOString(), fixtureVehicles: vehicles.length, controlVehicles: 2,
      vehicleAccess: { ...access, ...concurrent[2].value }, readSamples, planner: concurrent[1].value,
    }));
  } finally {
    if (listener) await close(listener);
    await pool.end();
    await Promise.all(liveConnections);
  }
}

for (const name of ['distributed', 'concentrated']) {
  const cluster = await freshCluster();
  try {
    await scenario(cluster, name);
  } finally {
    await cluster.close();
  }
}
