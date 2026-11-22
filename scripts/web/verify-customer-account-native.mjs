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
  const authPort = await port();
  stack = launch(['web/scripts/full-stack-server.mjs'], backend, {
    ...process.env, FULL_STACK_DATABASE: 'native', FULL_STACK_AUTH_PORT: String(authPort),
    TEST_DATABASE_URL: `postgresql://postgres:${password}@${loopback}:${pgPort}/charging_test`,
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
  const [recipient, outsider, billing] = await Promise.all([scenario.recipient, scenario.outsider, scenario.billing].map(tokenFor));

  await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', `/CN=${loopback}`, '-addext', `subjectAltName=IP:${loopback}`, '-keyout', privateKey, '-out', certificate]);
  let upstreamReads = 0, unexpectedRequests = 0, redirectUpstream = false;
  tls = createHttpsServer({ key: await readFile(privateKey), cert: await readFile(certificate) }, async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/v1/accounts' || request.headers.cookie) {
      unexpectedRequests += 1;
      response.writeHead(400).end();
      return;
    }
    upstreamReads += 1;
    if (redirectUpstream) {
      response.writeHead(307, { Location: '/unexpected' }).end();
      return;
    }
    try {
      const result = await fetchLocal(`${stackApi}/v1/accounts`, {
        headers: { Authorization: request.headers.authorization ?? '' },
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
  const account = async (token, status) => {
    const response = await fetchLocal(`${nextOrigin}/api/kundkonto`, {
      headers: { Cookie: 'flexexa_admin=fixture-must-stay-local', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    assert.equal(response.status, status);
    assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
    assert.equal(response.headers.get('set-cookie'), null);
    return response.json();
  };
  await account(null, 401);
  assert.equal(upstreamReads, 0);
  const altered = recipient.slice(0, -1) + (recipient.endsWith('a') ? 'b' : 'a');
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
  assert.equal(unexpectedRequests, 0);
  console.log('Verified Next customer accounts through native PostgreSQL with two isolated customers and a billing member.');
} finally {
  await stop(next);
  if (tls?.listening) {
    await new Promise(done => { tls.close(done); tls.closeAllConnections(); });
  }
  await stop(stack);
  if (clusterStarted) await cluster.stop();
  await rm(working, { recursive: true, force: true });
}
