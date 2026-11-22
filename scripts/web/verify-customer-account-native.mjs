import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { chmod, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { createRequire } from 'node:module';
import { createServer as createSocket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';

// Run after `pnpm build` with dependencies installed in both checkouts.
const backendArg = process.argv[2];
if (!backendArg) throw Error('Usage: node scripts/web/verify-customer-account-native.mjs CHARGING_SUBSCRIPTION_CHECKOUT');
const backend = resolve(backendArg);
const requireBackend = createRequire(join(backend, 'package.json'));
const { default: EmbeddedPostgres } = await import(requireBackend.resolve('embedded-postgres'));
const { Client } = requireBackend('pg');
const appRoot = resolve(import.meta.dirname, '../..');
const loopback = '127.0.0.1';
const stackApi = `http://${loopback}:4181`;
const stackControl = `http://${loopback}:4182`;
const fetchLocal = (url, options = {}) => fetch(url, {
  ...options, redirect: 'error', signal: AbortSignal.timeout(3000),
});
const working = await mkdtemp(join(tmpdir(), 'flexexa-next-account-'));
const certificate = join(working, 'loopback.pem');
const privateKey = join(working, 'loopback.key');
const runtimeFile = join(backend, 'web/.full-stack-runtime.json');
let cluster, clusterStarted, stack, next, tls;

async function port(preferred = 0) {
  const listener = createSocket().listen(preferred, loopback);
  await once(listener, 'listening');
  const selected = listener.address().port;
  await new Promise(done => listener.close(done));
  return selected;
}

function launch(args, cwd, env) {
  const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
  child.stopped = new Promise(done => {
    child.once('error', done);
    child.once('exit', done);
  });
  return child;
}

async function awaitHealthy(child, url, name) {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) throw Error(`${name} exited during startup`);
    try {
      const response = await fetchLocal(url);
      await response.body?.cancel();
      if (response.ok) return;
    } catch { /* Retry loopback transport only during startup. */ }
    await delay(200);
  }
  throw Error(`${name} did not become ready`);
}

async function stop(child) {
  if (!child || !child.kill('SIGTERM')) return;
  const timely = await Promise.race([child.stopped.then(() => true), delay(5000, false, { ref: false })]);
  if (!timely && child.kill('SIGKILL')) await child.stopped;
}

try {
  await Promise.all([port(4181), port(4182)]);
  const pgPort = await port();
  const password = randomUUID();
  if (process.getuid?.() === 0) await chmod(working, 0o711);
  cluster = new EmbeddedPostgres({
    databaseDir: join(working, 'postgres'), user: 'postgres', password, port: pgPort,
    postgresFlags: ['-h', loopback], onLog: () => {}, onError: () => {},
  });
  await cluster.initialise();
  await cluster.start();
  clusterStarted = true;
  await cluster.createDatabase('charging_test');
  const databaseUrl = `postgresql://postgres:${password}@${loopback}:${pgPort}/charging_test`;
  const authPort = await port();
  stack = launch(['web/scripts/full-stack-server.mjs'], backend, {
    ...process.env, FULL_STACK_DATABASE: 'native', FULL_STACK_AUTH_PORT: String(authPort),
    TEST_DATABASE_URL: databaseUrl,
  });
  await awaitHealthy(stack, `${stackControl}/health`, 'Charging stack');
  const runtime = JSON.parse(await readFile(runtimeFile, 'utf8'));
  assert.equal(runtime.mode, 'native-postgres');
  assert.equal(runtime.apiLocal, stackApi);
  assert.equal(runtime.authLocal, `http://${loopback}:${authPort}`);
  const seeded = await fetchLocal(`${stackControl}/scenario`, {
    method: 'POST', headers: { 'x-stack-control': runtime.controlKey },
  });
  assert.equal(seeded.status, 201);
  const scenario = await seeded.json();
  const tokenFor = async ({ email, password }) => {
    const response = await fetchLocal(`${runtime.authLocal}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
    });
    assert.equal(response.status, 200);
    return (await response.json()).access_token;
  };
  const [recipient, outsider, billing, owner] = await Promise.all([
    scenario.recipient, scenario.outsider, scenario.billing, scenario.owner,
  ].map(tokenFor));
  const productPath = `/v1/accounts/${scenario.company}/product-access`;
  const requested = await fetchLocal(`${stackApi}${productPath}`, {
    method: 'POST', headers: { Authorization: `Bearer ${owner}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ productKey: 'grid_rewards' }),
  });
  assert.equal(requested.status, 202);
  await requested.body?.cancel();

  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', `/CN=${loopback}`, '-addext', `subjectAltName=IP:${loopback}`, '-keyout', privateKey, '-out', certificate]);
  const orderPaths = new Set([scenario.company, scenario.customer].map(id => `/v1/accounts/${id}/orders?limit=10`));
  let upstreamReads = 0, productReads = 0, productWrites = 0, orderReads = 0, vehicleReads = 0, unexpectedRequests = 0, redirectUpstream = false;
  tls = createHttpsServer({ key: await readFile(privateKey), cert: await readFile(certificate) }, async (request, response) => {
    const accountList = request.url === '/v1/accounts';
    const productAccess = request.url === productPath;
    const orderList = orderPaths.has(request.url);
    const vehicleList = /^\/v1\/accounts\/([0-9a-f-]{36})\/vehicles\?limit=25(?:&after=[A-Za-z0-9_-]{1,512})?$/.exec(request.url);
    const knownVehicleAccount = vehicleList && [scenario.customer, scenario.other, scenario.company].includes(vehicleList[1]);
    const write = productAccess && request.method === 'POST';
    if ((!write && (request.method !== 'GET' || (!accountList && !productAccess && !orderList && !knownVehicleAccount))) || request.headers.cookie || request.headers.origin) {
      unexpectedRequests += 1;
      response.writeHead(400).end();
      return;
    }
    if (accountList) upstreamReads += 1;
    else if (orderList) orderReads += 1;
    else if (knownVehicleAccount) vehicleReads += 1;
    else if (write) productWrites += 1;
    else productReads += 1;
    if (redirectUpstream) {
      response.writeHead(307, { Location: '/unexpected' }).end();
      return;
    }
    try {
      const chunks = [];
      if (write) for await (const chunk of request) chunks.push(chunk);
      const body = write ? Buffer.concat(chunks).toString() : undefined;
      if (write) assert.equal(body, '{"productKey":"energy_optimization"}');
      const result = await fetchLocal(`${stackApi}${request.url}`, {
        method: request.method,
        headers: { Authorization: request.headers.authorization ?? '', ...(write ? { 'Content-Type': 'application/json' } : {}) },
        body,
      });
      response.writeHead(result.status, { 'Content-Type': result.headers.get('content-type') });
      response.end(Buffer.from(await result.arrayBuffer()));
    } catch {
      response.writeHead(502).end();
    }
  }).listen(0, loopback);
  await once(tls, 'listening');

  const nextPort = await port();
  next = launch([resolve(appRoot, 'node_modules/next/dist/bin/next'), 'start', '--hostname', loopback, '--port', String(nextPort)], appRoot, {
    ...process.env, NODE_ENV: 'production', NODE_EXTRA_CA_CERTS: certificate, NODE_TLS_REJECT_UNAUTHORIZED: '1',
    FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW: 'true', FLEXEXA_CUSTOMER_AUTH_URL: runtime.authOrigin,
    FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    FLEXEXA_CUSTOMER_API_URL: `https://${loopback}:${tls.address().port}`,
  });
  const nextOrigin = `http://${loopback}:${nextPort}`;
  await awaitHealthy(next, `${nextOrigin}/`, 'Next production build');
  const requestAccount = async (path, authorization, status, options = {}) => {
    const response = await fetchLocal(`${nextOrigin}/api/kundkonto${path}`, {
      method: options.method,
      headers: { Cookie: 'flexexa_admin=fixture-must-stay-local', ...(authorization ? { Authorization: authorization } : {}),
        ...(options.origin ? { Origin: options.origin } : {}) },
    });
    assert.equal(response.status, status);
    assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
    assert.equal(response.headers.get('set-cookie'), null);
    return response.json();
  };
  const account = (token, status) => requestAccount('', token ? `Bearer ${token}` : null, status);
  await account(null, 401);
  assert.equal(upstreamReads, 0);
  const signatureStart = recipient.lastIndexOf('.') + 1;
  const altered = recipient.slice(0, signatureStart) +
    (recipient[signatureStart] === 'a' ? 'b' : 'a') + recipient.slice(signatureStart + 1);
  await account(altered, 401);
  assert.equal(upstreamReads, 1);
  assert.deepEqual(await account(recipient, 200), {
    items: [{ id: scenario.customer, name: 'Recipient account', kind: 'personal', role: 'owner' }],
  });
  assert.deepEqual(await account(outsider, 200), {
    items: [{ id: scenario.other, name: 'Other account', kind: 'personal', role: 'owner' }],
  });
  const company = (await account(billing, 200)).items.filter(item => item.kind === 'business');
  assert.deepEqual(company, [{ id: scenario.company, name: 'Isolated test dealer', kind: 'business', role: 'billing' }]);
  assert.equal(upstreamReads, 4);
  redirectUpstream = true;
  assert.deepEqual(await account(recipient, 503), { error: 'UNAVAILABLE' });
  assert.equal(upstreamReads, 5);
  redirectUpstream = false;

  const products = (accountId, authorization, status) => requestAccount(`/${accountId}/produkter`, authorization, status);
  assert.deepEqual(await products(scenario.company, null, 401), { error: 'UNAUTHENTICATED' });
  assert.deepEqual(await products(scenario.company, 'Basic Zml4dHVyZQ==', 401), { error: 'UNAUTHENTICATED' });
  assert.deepEqual(await products('not-an-account-id', `Bearer ${billing}`, 400), { error: 'INVALID_INPUT' });
  assert.equal(productReads, 0);
  assert.deepEqual(await products(scenario.company, `Bearer ${outsider}`, 403), { error: 'ACCESS_DENIED' });
  const access = await products(scenario.company, `Bearer ${billing}`, 200);
  assert.ok(Array.isArray(access.items));
  assert.match(access.requests?.[0]?.requested_at ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.deepEqual({ ...access, items: access.items.toSorted((a, b) => a.product_key.localeCompare(b.product_key)) }, {
    items: ['charging_subscription', 'electricity_contract'].map(product_key => ({
      product_key, status: 'active', version: 1, expires_at: null, enabled: true,
    })),
    requests: [{ product_key: 'grid_rewards', requested_at: access.requests[0].requested_at }],
  });
  assert.equal(productReads, 2);
  const applyAccess = (key, token, status, origin = nextOrigin) => requestAccount(
    `/${scenario.company}/produkter/${key}`, token && `Bearer ${token}`, status, { method: 'POST', origin },
  );
  assert.deepEqual(await applyAccess('grid_rewards', owner, 400), { error: 'INVALID_INPUT' });
  assert.deepEqual(await applyAccess('energy_optimization', null, 401), { error: 'UNAUTHENTICATED' });
  assert.deepEqual(await applyAccess('energy_optimization', owner, 403, 'https://outside.invalid'), { error: 'ACCESS_DENIED' });
  assert.equal(productWrites, 0);
  assert.deepEqual(await applyAccess('energy_optimization', billing, 403), { error: 'ACCESS_DENIED' });
  assert.deepEqual(await applyAccess('energy_optimization', outsider, 403), { error: 'ACCESS_DENIED' });
  const expectedRequest = { requested: true, productKey: 'energy_optimization' };
  assert.deepEqual(await applyAccess('energy_optimization', owner, 202), expectedRequest);
  const firstWrite = await products(scenario.company, `Bearer ${billing}`, 200);
  assert.deepEqual(firstWrite.items, access.items);
  assert.deepEqual(firstWrite.requests.map(item => item.product_key).sort(), ['energy_optimization', 'grid_rewards']);
  assert.deepEqual(await applyAccess('energy_optimization', owner, 202), expectedRequest);
  const replayed = await products(scenario.company, `Bearer ${billing}`, 200);
  assert.deepEqual(replayed, firstWrite, 'Replayed request must keep one immutable request and must not grant access');
  assert.equal(productReads, 4);
  assert.equal(productWrites, 4);
  assert.equal(upstreamReads, 5);

  const fixture = async path => {
    const response = await fetchLocal(`${stackControl}/scenario/${scenario.id}/${path}`, {
      method: 'POST', headers: { 'x-stack-control': runtime.controlKey },
    });
    assert.equal(response.status, 201);
    return response.json();
  };
  const orders = (accountId, token, status, query = '') => requestAccount(
    `/${accountId}/bestallningar${query}`, token ? `Bearer ${token}` : null, status,
  );
  assert.deepEqual(await orders(scenario.company, null, 401), { error: 'UNAUTHENTICATED' });
  assert.deepEqual(await orders('not-an-account-id', billing, 400), { error: 'INVALID_INPUT' });
  assert.equal(orderReads, 0);
  assert.deepEqual(await orders(scenario.company, outsider, 403), { error: 'ACCESS_DENIED' });
  const prepaid = await orders(scenario.company, billing, 200);
  assert.match(prepaid.items?.[0]?.createdAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(prepaid, { items: [{ id: scenario.paidOrder, state: 'paid', createdAt: prepaid.items[0].createdAt,
    amountMinor: null, currency: null }] });
  const consumer = await fixture('consumer');
  const recurring = await orders(scenario.customer, recipient, 200);
  assert.match(recurring.items?.[0]?.createdAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(recurring, { items: [{ id: consumer.order, state: 'paid', createdAt: recurring.items[0].createdAt,
    amountMinor: 166000, currency: 'SEK' }] });
  await fixture('history');
  await fixture('roaming-finance');
  assert.deepEqual(await orders(scenario.company, recipient, 403), { error: 'ACCESS_DENIED' });
  const page = await orders(scenario.company, billing, 200, '?limit=30&after=untrusted');
  assert.deepEqual(Object.keys(page), ['items']);
  assert.equal(page.items.length, 10);
  assert.equal(new Set(page.items.map(item => item.id)).size, 10);
  assert.ok(page.items.every(item => item.state === 'pending' && item.amountMinor === null && item.currency === null));
  assert.equal(orderReads, 5);

  const vehicleFixture = new Client({ connectionString: databaseUrl });
  await vehicleFixture.connect();
  try {
    await vehicleFixture.query(`INSERT INTO charging_subscription.vehicles(id,account_id,country,plate)
      SELECT gen_random_uuid(),$1,'SE','ZZX'||lpad(i::text,5,'0') FROM generate_series(1,24) AS g(i)`, [scenario.customer]);
    const subscription = randomUUID();
    await vehicleFixture.query(`INSERT INTO charging_subscription.subscriptions(id,account_id,vehicle_id,contract,billing,starts_at,ends_at)
      VALUES($1,$2,$3,'active','paid',now()-interval '1 hour',now()+interval '1 day')`, [subscription, scenario.customer, scenario.car]);
    const { rows: [{ principal_id: principal }] } = await vehicleFixture.query(
      'SELECT principal_id FROM charging_subscription.identities WHERE issuer=$1 AND subject=$2', [runtime.authOrigin + '/auth/v1', scenario.outsider.id],
    );
    await vehicleFixture.query(`INSERT INTO charging_subscription.memberships(account_id,principal_id,role) VALUES($1,$2,'driver')`, [scenario.customer, principal]);
    await vehicleFixture.query(`INSERT INTO charging_subscription.driver_grants(account_id,principal_id,subscription_id) VALUES($1,$2,$3)`, [scenario.customer, principal, subscription]);
  } finally {
    await vehicleFixture.end();
  }

  const vehicles = (accountId, token, status, query = '') => requestAccount(`/${accountId}/fordon${query}`, token && `Bearer ${token}`, status);
  assert.deepEqual(await vehicles(scenario.customer, null, 401), { error: 'UNAUTHENTICATED' });
  assert.deepEqual(await vehicles('not-an-id', recipient, 400), { error: 'INVALID_INPUT' });
  assert.deepEqual(await vehicles(scenario.customer, recipient, 400, '?after=a&after=b'), { error: 'INVALID_INPUT' });
  assert.deepEqual(await vehicles(scenario.customer, recipient, 400, '?limit=100'), { error: 'INVALID_INPUT' });
  assert.equal(vehicleReads, 0);
  const firstPage = await vehicles(scenario.customer, recipient, 200);
  assert.equal(firstPage.items.length, 25);
  assert.deepEqual(firstPage.items.slice(0, 2).map(({ id }) => id), [scenario.wrongCar, scenario.car]);
  assert.deepEqual(Object.keys(firstPage.items[1]).sort(), ['country', 'id', 'plate', 'verified_at']);
  assert.match(firstPage.nextCursor, /^[A-Za-z0-9_-]+$/);
  const cursorQuery = `?after=${encodeURIComponent(firstPage.nextCursor)}`;
  const tail = await vehicles(scenario.customer, recipient, 200, cursorQuery);
  assert.equal(tail.items.length, 1);
  assert.equal(tail.items[0].plate, 'ZZX00024');
  assert.equal(tail.nextCursor, null);
  assert.deepEqual(await vehicles(scenario.other, outsider, 400, cursorQuery), { error: 'INVALID_CURSOR' });
  assert.deepEqual(await vehicles(scenario.company, outsider, 403), { error: 'ACCESS_DENIED' });
  assert.deepEqual(await vehicles(scenario.customer, outsider, 200), { items: [firstPage.items[1]], nextCursor: null });
  assert.equal(vehicleReads, 5);
  assert.equal(unexpectedRequests, 0);
  console.log('Verified Next account, product, order and paged vehicle flows through PostgreSQL with tenant, billing and driver isolation.');
} finally {
  await stop(next);
  if (tls?.listening) {
    await new Promise(done => { tls.close(done); tls.closeAllConnections(); });
  }
  await stop(stack);
  if (clusterStarted) await cluster.stop();
  await rm(working, { recursive: true, force: true });
}
