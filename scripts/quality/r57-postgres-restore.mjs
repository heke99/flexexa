import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const [backendPath] = process.argv.slice(2);
if (!backendPath) throw Error("Usage: node scripts/quality/r57-postgres-restore.mjs CHARGING_SUBSCRIPTION_CHECKOUT");
const backend = resolve(backendPath);
const require = createRequire(join(backend, "package.json"));
const pg = require("pg");
const load = name => import(pathToFileURL(join(backend, "src", name)).href);
const [{Database}, {Service}, {EnergyService}, {server}, {SimulatedVehicleProvider},
  {runFleetPlanJob}, {runEnergyCommand}] = await Promise.all([
  "db.mjs", "service.mjs", "energy-service.mjs", "http.mjs", "simulated-vehicle-provider.mjs",
  "fleet-plan-worker.mjs", "energy-command-worker.mjs",
].map(load));
const postgresBin = command => process.env.R57_POSTGRES_BIN ? resolve(process.env.R57_POSTGRES_BIN, command) : command;
const clientBin = command => process.env.R57_POSTGRES_CLIENT_BIN ? resolve(process.env.R57_POSTGRES_CLIENT_BIN, command) : postgresBin(command);
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG")));
const launch = (command, args, options = {}) => run(command, args, {env: environment, timeout: 60_000, ...options});
const working = await mkdtemp("/tmp/fx-r57-");
const socket = join(working, "s");
const data = join(working, "pgdata");
const recoverySocket = join(working, "r");
const recoveryData = join(working, "recovery-pgdata");
const roles = join(working, "roles.sql");
const archive = join(working, "recovery.dump");
const username = "r57_admin";
const port = 5432;
const protocol = {host: socket, port, user: username, connectionTimeoutMillis: 3000};
const sourceDatabase = "r57_source";
const restoreDatabase = "r57_restored";
const shutdown = [];
const migration44 = "044-simulated-meter-goals.sql";
const command47 = "047-energy-command-reconciliation-backoff.sql";
const quarter = 15 * 60_000;
let simulatedNow = Math.floor(Date.now() / quarter) * quarter;
const provider = new SimulatedVehicleProvider({clock: () => simulatedNow});
const metricMs = start => Math.round(performance.now() - start);
const historyVehicles = 12000;
const historySessions = 24000;
const runningClusters = [];
const metrics = {};

async function startCluster(directory, host, owner) {
  await mkdir(host, {mode: 0o700});
  await launch(postgresBin("initdb"), ["-D", directory, "-U", owner, "-A", "trust", "--no-locale"]);
  await launch(postgresBin("pg_ctl"), ["-D", directory, "-l", join(directory, "postgres.log"), "-w", "-t", "15",
    "-o", `-h '' -k '${host}' -p ${port} -c unix_socket_permissions=0700`, "start"]);
  runningClusters.push(directory);
}

async function connect(database, host = socket) {
  const client = new pg.Client({...protocol, host, database});
  await client.connect();
  shutdown.push(() => client.end());
  const {rows: [target]} = await client.query(`
    SELECT current_database() AS db, inet_server_addr() IS NULL AS local,
           current_setting('unix_socket_directories') AS socket, current_user AS actor`);
  assert.deepEqual(target, {db: database, local: true, socket: host, actor: username});
  return client;
}

async function migration(database, cwd) {
  const url = new URL(`postgresql://${username}@localhost/${database}`);
  url.searchParams.set("host", socket);
  url.searchParams.set("application_name", "flexexa_r57_migrate");
  const urlFile = join(working, `${database}.url`);
  await writeFile(urlFile, url.href, {mode: 0o600});
  const process = spawn(processExec, [join(backend, "scripts/migrate.mjs")], {
    cwd, env: {...environment, MIGRATION_DATABASE_URL_FILE: urlFile}, stdio: ["ignore", "ignore", "pipe"],
  });
  let errors = "";
  process.stderr.setEncoding("utf8").on("data", chunk => { errors += chunk; });
  const outcome = new Promise((accept, reject) => {
    process.once("error", reject);
    process.once("close", (code, signal) => accept({code, signal, errors}));
  });
  return {process, outcome};
}
const processExec = process.execPath;

async function checkMigration(job) {
  const result = await job.outcome;
  assert.equal(result.code, 0, result.errors);
}

async function waitForMigrationLock(observer, blockerPid) {
  const deadline = performance.now() + 5000;
  while (performance.now() < deadline) {
    const {rows: [state]} = await observer.query(`
      SELECT wait_event_type, wait_event,
             pg_blocking_pids(pid) @> ARRAY[$1::integer] AS blocked,
             query LIKE 'ALTER TABLE charging_subscription.energy_vehicle_profiles%' AS migrating_goals
      FROM pg_stat_activity WHERE application_name='flexexa_r57_migrate'`, [blockerPid]);
    if (state?.wait_event_type === "Lock" && state.blocked && state.migrating_goals) return state.wait_event;
    await delay(25);
  }
  throw Error("The expected migration lock was not observed");
}

async function fingerprint(connection) {
  return (await connection.query(`
    SELECT
      (SELECT count(*)::int FROM charging_subscription.energy_vehicle_profiles WHERE target_percent IS NOT NULL) AS profiles,
      (SELECT md5(string_agg(concat_ws(':',vehicle_id,target_percent,battery_kwh,efficiency,settings_version),
                            ',' ORDER BY vehicle_id))
       FROM charging_subscription.energy_vehicle_profiles WHERE target_percent IS NOT NULL) AS legacy_digest,
      (SELECT count(*)::int FROM charging_subscription.sessions) AS sessions,
      (SELECT md5(string_agg(concat_ws(':',id,account_id,subscription_id,vehicle_id,status,created_at),
                            ',' ORDER BY id))
       FROM charging_subscription.sessions) AS session_digest`)).rows[0];
}

async function seedHistory(connection) {
  await connection.query(`
    INSERT INTO charging_subscription.accounts(id,kind,name)
    SELECT md5('r57-fleet-'||company)::uuid,'business','R57 fixture '||company
    FROM generate_series(0,1) AS company;
    INSERT INTO charging_subscription.product_access(account_id,product_key,status,version,approved_by,reason)
    SELECT id,product,'active',1,md5('r57-history-approver')::uuid,'Isolated R57 fixture'
    FROM charging_subscription.accounts CROSS JOIN unnest(ARRAY['energy_optimization','external_api']) AS product;
    INSERT INTO charging_subscription.vehicles(id,account_id,country,plate)
    SELECT md5('r57-car-'||n)::uuid,md5('r57-fleet-'||(n%2))::uuid,'SE','R57'||n
    FROM generate_series(1,12000) AS n;
    INSERT INTO charging_subscription.energy_vehicle_profiles
      (account_id,vehicle_id,provider_key,is_simulated,make,model,battery_kwh,efficiency,
       min_kw,max_kw,capabilities,target_percent,mode,available_from,departure_at,priority,settings_version)
    SELECT account_id,id,'simulator',true,'Synthetic','R57',
           45 + n % 40,0.9,0,11,'["read_soc"]'::jsonb,60 + n % 30,'paused',
           '2026-09-01 01:00Z','2026-09-01 09:00Z',1, 1 + n % 9
    FROM (SELECT *,substring(plate,4)::int AS n FROM charging_subscription.vehicles) AS vehicle;
    INSERT INTO charging_subscription.energy_vehicle_shadows
      (account_id,vehicle_id,soc_percent,plugged,power_kw,energy_wh,reported_at,state_version,quality)
    SELECT account_id,id,50,false,0,substring(plate,4)::int,'2026-09-01 07:00Z',1,'simulated'
    FROM charging_subscription.vehicles;
    INSERT INTO charging_subscription.subscriptions
      (id,account_id,vehicle_id,contract,billing,starts_at,ends_at)
    SELECT md5('r57-sub-'||id)::uuid,account_id,id,'ended','paid','2026-08-01 00:00Z','2026-11-01 00:00Z'
    FROM charging_subscription.vehicles;
    INSERT INTO charging_subscription.sessions
      (id,account_id,subscription_id,vehicle_id,evse_id,provider,provider_session_id,status,created_at,updated_at)
    SELECT md5('r57-history-'||s.id||month)::uuid,s.account_id,s.id,s.vehicle_id,'R57-PROBE',
           'r57-fixture',s.id||'-'||month,'completed',
           '2026-09-01 08:00Z'::timestamptz + make_interval(months=>month),
           '2026-09-01 09:00Z'::timestamptz + make_interval(months=>month)
    FROM charging_subscription.subscriptions AS s CROSS JOIN generate_series(0,1) AS month;
  `);
}

async function verifyRls(connection) {
  await connection.query("BEGIN");
  try {
    await connection.query("SET LOCAL ROLE charging_api");
    await connection.query(`SELECT set_config('charging.role','owner',true),
      set_config('charging.account',md5('r57-fleet-0')::uuid::text,true)`);
    const {rows:[scope]} = await connection.query(`
      SELECT count(*)::int AS visible,
             count(*) FILTER (WHERE account_id=md5('r57-fleet-1')::uuid)::int AS outside
      FROM charging_subscription.energy_vehicle_profiles`);
    assert.deepEqual(scope, {visible: 6000, outside: 0});
    return scope;
  } finally {
    await connection.query("ROLLBACK");
  }
}

async function app(database, claim, host = socket) {
  const pool = new pg.Pool({...protocol, host, database, max: 4});
  shutdown.push(() => pool.end());
  const db = new Database(pool);
  const service = new Service(db, {clock: () => new Date(simulatedNow)});
  const prices = {window: async (_area, start, end) => ({
    provider: "r57-fixture",
    slots: Array.from({length: (end - start) / quarter}, () => ({price_sek_per_kwh: 1})),
  })};
  const energy = new EnergyService(db, {service, prices, provider, simulationEnabled: true, clock: () => simulatedNow});
  const http = server({service, energy, prices, fleetPlanningEnabled: true, auth: {
    verify: async token => {
      assert.equal(token, "r57-isolated-fixture");
      return claim;
    },
  }});
  await new Promise((listen, reject) => {
    http.once("error", reject);
    http.listen(0, "127.0.0.1", listen);
  });
  shutdown.push(() => new Promise(close => http.close(close)));
  async function request(account, endpoint, body) {
    const response = await fetch(`http://127.0.0.1:${http.address().port}/v1/accounts/${account}/${endpoint}`, {
      method: body ? "POST" : "GET",
      headers: {authorization: "Bearer r57-isolated-fixture", "content-type": "application/json",
        "idempotency-key": `r57:${endpoint}`},
      body: body ? JSON.stringify(body) : undefined,
    });
    return {status: response.status, body: await response.json()};
  }
  const tick = () => runEnergyCommand(db, {provider, simulationEnabled: true, clock: () => simulatedNow});
  return {db, service, request, tick};
}

try {
  await startCluster(data, socket, username);
  await startCluster(recoveryData, recoverySocket, username);
  const admin = await connect("postgres");
  await admin.query("CREATE DATABASE r57_source");
  const source = await connect(sourceDatabase);
  metrics.postgres = (await source.query("SHOW server_version")).rows[0].server_version;

  const legacy = join(working, "legacy");
  const legacyScripts = join(legacy, "database");
  await mkdir(legacyScripts, {recursive: true});
  const migrationNames = (await readdir(join(backend, "database"))).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  assert.ok(migrationNames.includes(migration44));
  assert.ok(migrationNames.includes(command47));
  for (const name of migrationNames.filter(name => Number.parseInt(name, 10) <= 43)) {
    await symlink(join(backend, "database", name), join(legacyScripts, name));
  }
  await checkMigration(await migration(sourceDatabase, legacy));
  await seedHistory(source);
  const before = await fingerprint(source);
  assert.equal(before.profiles, historyVehicles);
  assert.equal(before.sessions, historySessions);

  const blocker = await connect(sourceDatabase);
  await blocker.query("BEGIN");
  await blocker.query("LOCK TABLE charging_subscription.energy_vehicle_profiles IN ACCESS SHARE MODE");
  const started = performance.now();
  const interrupted = await migration(sourceDatabase, backend);
  try {
    metrics.ddl_wait_event = await waitForMigrationLock(source, blocker.processID);
    metrics.ddl_wait_observed_ms = metricMs(started);
    const traffic = await connect(sourceDatabase);
    await traffic.query("SET lock_timeout TO '200ms'");
    const otherRead = performance.now();
    assert.equal((await traffic.query("SELECT count(*)::int AS n FROM charging_subscription.vehicles")).rows[0].n, historyVehicles);
    metrics.unrelated_table_read_ms = metricMs(otherRead);
    const blockedRead = performance.now();
    await assert.rejects(traffic.query("SELECT count(*) FROM charging_subscription.energy_vehicle_profiles"), {code: "55P03"});
    metrics.profile_read_lock_timeout_ms = metricMs(blockedRead);
  } finally {
    interrupted.process.kill("SIGTERM");
    assert.equal((await interrupted.outcome).signal, "SIGTERM");
    await blocker.query("ROLLBACK");
  }
  const {rows:[partial]} = await source.query(`
    SELECT EXISTS (SELECT FROM charging_migrations.history WHERE name=$1) AS applied,
           EXISTS (SELECT FROM information_schema.columns
                   WHERE table_schema='charging_subscription' AND table_name='energy_vehicle_profiles'
                     AND column_name='target_energy_wh') AS added`, [migration44]);
  assert.deepEqual(partial, {applied: false, added: false});
  assert.deepEqual(await fingerprint(source), before);

  const rerun = performance.now();
  await checkMigration(await migration(sourceDatabase, backend));
  metrics.migration_resume_ms = metricMs(rerun);
  const journal = (await source.query("SELECT name,sha256 FROM charging_migrations.history ORDER BY name")).rows;
  assert.deepEqual(journal.map(row => row.name), migrationNames);
  await checkMigration(await migration(sourceDatabase, backend));
  assert.deepEqual((await source.query("SELECT name,sha256 FROM charging_migrations.history ORDER BY name")).rows, journal);
  assert.deepEqual(await fingerprint(source), before);
  assert.equal((await source.query("SELECT count(*)::int AS n FROM charging_subscription.energy_vehicle_profiles WHERE target_energy_wh IS NULL")).rows[0].n, historyVehicles);

  const claim = {issuer: "https://r57-fixture.invalid", subject: "r57-owner", recent: true};
  const sourceApp = await app(sourceDatabase, claim);
  const account = (await sourceApp.service.createPersonal(claim, "R57 pilot")).id;
  const principal = (await source.query("SELECT personal_owner FROM charging_subscription.accounts WHERE id=$1", [account])).rows[0].personal_owner;
  await source.query("UPDATE charging_subscription.accounts SET kind='business',personal_owner=NULL WHERE id=$1", [account]);
  await source.query(`INSERT INTO charging_subscription.product_access(account_id,product_key,status,version,approved_by,reason)
    SELECT $1,product,'active',1,$2,'Isolated R57 fixture'
    FROM unnest(ARRAY['energy_optimization','external_api']) AS product`, [account, principal]);
  const vehicle = (await sourceApp.service.addVehicle(claim, account, {country: "SE", plate: "R57TEST"}, "r57-car-registration")).id;
  provider.provision({accountId: account, vehicleId: vehicle, maxKw: 4, soc: null, batteryKwh: null, efficiency: null,
    energyWh: 12000, capabilities: ["read_energy", "start_charge", "stop_charge", "set_power_limit"]});
  const enrollment = await sourceApp.request(account, `energy-vehicles/${vehicle}/enroll`, {
    targetKwh: 1, mode: "now", availableFrom: new Date(simulatedNow).toISOString(),
    departureAt: new Date(simulatedNow + quarter).toISOString(), priority: 1, consent: true,
  });
  assert.equal(enrollment.status, 201, JSON.stringify(enrollment.body));
  const submitted = await sourceApp.request(account, "energy-planning", {area: "SE3", siteLimitKw: 4});
  assert.equal(submitted.status, 202, JSON.stringify(submitted.body));
  assert.equal((await runFleetPlanJob(sourceApp.db)).status, "completed");
  assert.equal((await sourceApp.request(account, `energy-plans/${submitted.body.id}/simulate`, {})).status, 202);
  let executeAttempts = 0;
  const execute = provider.executeCommand.bind(provider);
  provider.executeCommand = async command => { executeAttempts++; return execute(command); };
  provider.loseNextAcknowledgement = true;
  assert.equal((await sourceApp.tick()).status, "uncertain");
  assert.equal(provider.effects.size, 1);

  const beforeDump = performance.now();
  const connectionArgs = ["--host", socket, "--port", String(port), "--username", username];
  await launch(clientBin("pg_dumpall"), [...connectionArgs, "--roles-only", "--no-role-passwords", "--file", roles]);
  const roleScript = await readFile(roles, "utf8");
  const bootstrapRole = `CREATE ROLE ${username};\n`;
  assert.equal(roleScript.split(bootstrapRole).length, 2);
  await writeFile(roles, roleScript.replace(bootstrapRole, ""), {mode: 0o600});
  await launch(clientBin("pg_dump"), [...connectionArgs, "--format=custom", "--file", archive, sourceDatabase]);
  metrics.dump_ms = metricMs(beforeDump);
  metrics.dump_bytes = (await stat(archive)).size;
  const recoveryBegan = performance.now();
  const recoveryArgs = ["--host", recoverySocket, "--port", String(port)];
  await launch(clientBin("psql"), [...recoveryArgs, "--username", username, "--dbname", "postgres",
    "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--single-transaction", "--file", roles]);
  const recovery = await connect("postgres", recoverySocket);
  await recovery.query("CREATE DATABASE r57_restored");
  metrics.roles_and_database_ms = metricMs(recoveryBegan);
  const restoreBegan = performance.now();
  await launch(clientBin("pg_restore"), [...recoveryArgs, "--username", username, "--single-transaction", "--exit-on-error",
    "--dbname", restoreDatabase, archive]);
  metrics.restore_ms = metricMs(restoreBegan);
  metrics.independent_recovery_cluster = true;
  const restored = await connect(restoreDatabase, recoverySocket);
  const restoredApp = await app(restoreDatabase, claim, recoverySocket);
  assert.deepEqual(await fingerprint(restored), before);
  assert.deepEqual((await restored.query("SELECT name,sha256 FROM charging_migrations.history ORDER BY name")).rows, journal);
  metrics.restored_api_rls = await verifyRls(restored);

  simulatedNow += 2 * quarter;
  const commands = async () => {
    const result = await restoredApp.request(account, "energy-commands");
    assert.equal(result.status, 200);
    assert.equal(result.body.items.length, 1);
    return result.body.items[0];
  };
  const old = await commands();
  assert.equal(old.state, "uncertain");
  assert.equal(old.acknowledgement, null);
  assert.equal((await restoredApp.tick()).status, "simulated");
  const recovered = await commands();
  assert.equal(recovered.id, old.id);
  assert.equal(recovered.state, "simulated");
  assert.equal(recovered.acknowledgement.power_kw, 4);
  const vehicleState = await restoredApp.request(account, "energy-vehicles");
  assert.equal(vehicleState.status, 200);
  assert.equal(Number(vehicleState.body.items[0].delivered_energy_wh), 1000);
  assert.equal(Number(vehicleState.body.items[0].power_kw), 0);
  assert.equal((await restoredApp.tick()).status, "idle");
  assert.equal(executeAttempts, 1);
  assert.equal(provider.effects.size, 1);
  metrics.restore_to_reconciled_ms = metricMs(recoveryBegan);
  const {stdout} = await launch("git", ["rev-parse", "HEAD"], {cwd: backend});
  const {stdout: status} = await launch("git", ["status", "--porcelain", "--",
    "database", "src", "scripts/migrate.mjs", "package.json", "package-lock.json", "workers/fleet-planner"], {cwd: backend});
  console.log(JSON.stringify({case: "R57", result: "pass", backend_revision: stdout.trim(),
    clean_backend_runtime: status.length === 0, legacy_profiles: before.profiles, historic_sessions: before.sessions,
    migration_history_entries: journal.length, simulated_execute_attempts: executeAttempts,
    simulated_effects: provider.effects.size, restored_meter_wh: 1000, ...metrics}));
} finally {
  try {
    for (const cleanup of shutdown.reverse()) await cleanup();
  } finally {
    try {
      const stopped = await Promise.allSettled(runningClusters.map(directory =>
        launch(postgresBin("pg_ctl"), ["-D", directory, "-w", "-t", "15", "-m", "fast", "stop"])));
      const failure = stopped.find(result => result.status === "rejected");
      if (failure) throw failure.reason;
    } finally {
      await rm(working, {recursive: true, force: true});
    }
  }
}
