import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createSocket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const host = '127.0.0.1';
const account = '12345678-1234-4123-8123-123456781234';
const authorization = 'Bearer private.fixture.credential';
const marker = 'private fixture upstream payload';
const prefix = '/api/kundkonto';
const orders = `${prefix}/${account}/bestallningar`;
const products = `${prefix}/${account}/produkter`;
const vehicles = `${prefix}/${account}/fordon?after=YQ`;
const tmp = await mkdtemp(join(tmpdir(), 'flexexa-customer-contract-'));
const certificate = join(tmp, 'cert.pem');
const key = join(tmp, 'key.pem');
const nextBin = resolve('node_modules/next/dist/bin/next');
const processes = [];
const calls = [];
const requests = new Set();
let fixture;

async function start(flag) {
  const listener = createSocket().listen(0, host);
  await once(listener, 'listening');
  const { port } = listener.address();
  await new Promise(done => listener.close(done));
  const upstream = `https://${host}:${fixture.address().port}`;
  const child = spawn(process.execPath, [nextBin, 'start', '--hostname', host, '--port', String(port)], {
    env: { ...process.env, NODE_ENV: 'production', NODE_EXTRA_CA_CERTS: certificate,
      FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW: flag, FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW: 'false',
      FLEXEXA_CUSTOMER_AUTH_URL: upstream, FLEXEXA_CUSTOMER_API_URL: upstream,
      FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY: 'sb_publishable_customer_contract_fixture' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  const stopped = once(child, 'exit');
  processes.push({ child, stopped });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk; });
  const base = `http://${host}:${port}`;
  for (let wait = 0; wait < 100; wait++) {
    assert.equal(child.exitCode, null, stderr);
    const ready = await fetch(base, { signal: AbortSignal.timeout(1000) }).catch(() => null);
    if (ready?.ok) {
      await ready.body.cancel();
      return { base, logs: () => stderr };
    }
    await delay(100);
  }
  throw new Error(`Next did not become ready: ${stderr}`);
}

async function probe(next, path, status, body, technicalClass = null, retryAfter = null) {
  const response = await fetch(next.base + path, {
    headers: { Authorization: authorization, 'X-Request-ID': marker }, signal: AbortSignal.timeout(14000),
  });
  assert.equal(response.status, status);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-flexexa-error-class'), technicalClass);
  assert.equal(response.headers.get('retry-after'), retryAfter);
  const requestId = response.headers.get('x-request-id');
  assert.match(requestId, /^[0-9a-f-]{36}$/);
  assert.ok(!requests.has(requestId));
  requests.add(requestId);
  assert.deepEqual(await response.json(), body);
  return requestId;
}

try {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', `/CN=${host}`,
    '-addext', `subjectAltName=IP:${host}`, '-keyout', key, '-out', certificate], { stdio: 'ignore' });
  const reply = { status: 200, body: { items: [] } };
  fixture = createHttpsServer({ cert: await readFile(certificate), key: await readFile(key) }, (request, response) => {
    calls.push(request.url);
    assert.equal(request.headers.authorization, authorization);
    if (reply.stall) return;
    response.writeHead(reply.status, { 'Content-Type': 'application/json', ...reply.headers });
    response.end(reply.raw ?? JSON.stringify(reply.body));
  }).listen(0, host);
  await once(fixture, 'listening');
  const next = await start('true');
  const invalid = await start('TRUE');
  const expected = [];
  const technical = async (target, path, status, name, route) => {
    const requestId = await probe(target, path, status, { error: 'UNAVAILABLE' }, name);
    expected.push({ requestId, name, route, status: reply.status });
  };

  await technical(invalid, prefix, 404, 'CONFIGURATION_INVALID', 'accounts');
  assert.equal(calls.length, 0);
  Object.assign(reply, { status: 403, body: { error: 'MFA_REQUIRED', secret: marker } });
  await probe(next, prefix, 403, { error: 'MFA_REQUIRED' });
  reply.body = { error: marker };
  await probe(next, prefix, 403, { error: 'ACCESS_DENIED' });
  reply.status = 401;
  await probe(next, prefix, 401, { error: 'UNAUTHENTICATED' });
  Object.assign(reply, { status: 429, headers: { 'Retry-After': '7' } });
  await probe(next, prefix, 429, { error: 'RATE_LIMITED' }, null, '7');
  Object.assign(reply, { status: 400, body: { error: 'INVALID_CURSOR' }, headers: {} });
  await probe(next, vehicles, 400, { error: 'INVALID_CURSOR' });
  assert.equal(calls.at(-1), `/v1/accounts/${account}/vehicles?limit=25&after=YQ`);
  const count = calls.length;
  await probe(next, prefix + '/00000000-0000-0000-0000-000000000000/produkter', 400, { error: 'INVALID_INPUT' });
  assert.equal(calls.length, count);

  Object.assign(reply, { status: 422, body: { error: marker } });
  await technical(next, prefix, 503, 'COMMERCE_REJECTED', 'accounts');
  reply.status = 502;
  await technical(next, prefix, 503, 'COMMERCE_UNAVAILABLE', 'accounts');
  Object.assign(reply, { status: 200, raw: marker });
  await technical(next, prefix, 503, 'COMMERCE_INVALID_RESPONSE', 'accounts');
  delete reply.raw;
  reply.body = { items: [{ id: account, state: 'pending', created_at: '2026-11-26T10:00:00Z',
    agreement: { amount_minor: marker, currency: 'SEK' } }] };
  await technical(next, orders, 503, 'COMMERCE_INVALID_RESPONSE', 'orders');
  reply.body = { items: [{ product_key: marker }], requests: [] };
  await technical(next, products, 503, 'COMMERCE_INVALID_RESPONSE', 'products');
  reply.body = { items: [], requests: [] };
  await probe(next, products, 200, reply.body);
  Object.assign(reply, { status: 302, headers: { Location: `https://${host}:${fixture.address().port}/unexpected` } });
  await technical(next, prefix, 503, 'COMMERCE_TRANSPORT', 'accounts');
  assert.ok(!calls.includes('/unexpected'));
  reply.stall = true;
  await technical(next, prefix, 503, 'COMMERCE_TIMEOUT', 'accounts');

  const logs = next.logs() + invalid.logs();
  assert.ok([account, authorization, marker].every(secret => !logs.includes(secret)));
  const fields = logs.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line));
  assert.equal(fields.length, expected.length);
  for (const { requestId, route, name, status } of expected) {
    const record = fields.find(entry => entry.requestId === requestId);
    const withUpstreamStatus = ['COMMERCE_REJECTED', 'COMMERCE_UNAVAILABLE', 'COMMERCE_INVALID_RESPONSE'].includes(name);
    assert.deepEqual(record, { event: 'customer_api_failure', requestId, route, technicalClass: name,
      ...(withUpstreamStatus ? { upstreamStatus: status } : {}),
      ...(name === 'CONFIGURATION_INVALID' ? { fields: ['FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW'] } : {}) });
  }
  console.log('Customer API verified against local production Next and loopback HTTPS');
} finally {
  for (const { child } of processes) child.kill();
  await Promise.all(processes.map(({ stopped }) => stopped));
  if (fixture) {
    fixture.closeAllConnections();
    await new Promise(done => fixture.close(done));
  }
  await rm(tmp, { recursive: true, force: true });
}
