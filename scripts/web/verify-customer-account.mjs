import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes, randomUUID, X509Certificate } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createSocket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const host = '127.0.0.1';
const portal = 'https://ladda.flexexa.com/';
const overview = '/app/konto/oversikt';
const loginHelp = '/app/konto/hjalp';
const publishableKey = 'sb_publishable_local_browser_fixture';
const password = 'fixture-only-customer-password';
const incorrectCode = '135790';
const validCode = '648275';
const validEmailCode = '825174';
const verifiedFactor = { id: '44444444-4444-4444-8444-444444444444', factor_type: 'totp', status: 'verified' };
const secondFactors = [
  { id: '55555555-5555-4555-8555-555555555555', factor_type: 'totp', status: 'unverified' },
  { id: '66666666-6666-4666-8666-666666666666', factor_type: 'phone', status: 'verified' },
  verifiedFactor,
];
const challengePath = `/auth/v1/factors/${verifiedFactor.id}/challenge`;
const verifyPath = `/auth/v1/factors/${verifiedFactor.id}/verify`;
const personal = { id: '11111111-1111-4111-8111-111111111111', kind: 'personal', name: 'Konto Grön', role: 'owner' };
const company = { id: '33333333-3333-4333-8333-333333333333', kind: 'business', name: 'Konto Guld', role: 'owner' };
const otherCompany = { id: '22222222-2222-4222-8222-222222222222', kind: 'business', name: 'Konto Blå', role: 'billing' };
const createdPersonalId = '99999999-9999-4999-8999-111111111111';
const accounts = {
  first: [personal, company],
  second: [otherCompany],
};
const userIds = { first: randomUUID(), second: randomUUID() };
const productPath = ({ id }) => `/v1/accounts/${id}/product-access`;
const privateOrder = '77777777-7777-4777-8777-777777777777';
const companyOrder = '88888888-8888-4888-8888-888888888888';
const personalSession = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const companySession = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const vehicleCursor = 'eyJ4IjoxfQ';
const grant = (product_key, enabled, status = 'active') => ({ product_key, status, version: 4, enabled, expires_at: null });
const productAccess = new Map([
  [personal.id, { items: [grant('charging_subscription', true), grant('grid_rewards', true)], requests: [] }],
  [company.id, { items: [grant('energy_optimization', true), grant('external_api', true)], requests: [
    { product_key: 'charging_subscription', requested_at: '2026-11-21T10:00:00Z' },
  ] }],
  [otherCompany.id, { items: [
    grant('charging_subscription', false, 'revoked'),
    grant('energy_optimization', false),
  ], requests: [] }],
]);
const childProcesses = [];
const verified = [];

async function pending(expectation, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await expectation()) return;
    await delay(100);
  }
  assert.fail('The expected browser or service state did not appear before the deadline');
}

async function portAvailable() {
  const socket = createSocket();
  socket.listen(0, host);
  await once(socket, 'listening');
  const { port } = socket.address();
  await new Promise((done) => socket.close(done));
  return port;
}

function launch(executable, args, options = {}) {
  const child = spawn(executable, args, { stdio: 'inherit', ...options });
  let failure;
  child.on('error', (error) => { failure = error; });
  childProcesses.push(child);
  return () => {
    if (failure) throw failure;
    assert.equal(child.exitCode, null, `${executable} stopped before verification completed`);
  };
}

async function request(url, options = {}) {
  return fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(6000), ...options });
}

function assertPortalRedirect(response, expected) {
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), expected);
  assert.match(response.headers.get('cache-control') ?? '', /\bno-store\b/);
  assert.equal(response.headers.get('set-cookie'), null);
}

const scratch = await mkdtemp(join(tmpdir(), 'flexexa-customer-browser-'));
const certificatePath = join(scratch, 'cert.pem');
const privateKeyPath = join(scratch, 'key.pem');
const calls = [];
const issued = new Map();
const challenges = new Map();
const nextProductReply = new Map();
const signingKey = randomBytes(32);
let fixture;
let heldOrderReply;
let heldSessionReply;
const accountsWithoutSessions = new Set();
let loseAccountCreationReply = false;
let heldAccountCreationReply;
let heldCreatedAccountList;
let privateOrderState = 'pending';
let startURL;
let upstream;
let secondHasTotp = false;
let heldTotpReply;
let heldEmailReply;
let otpRequests = 0;
let availableEmailCode = false;
let webdriver;
let session;

function issueAuthSession(actor, user, sessionId, assurance, signInMethod = 'password') {
  const timestamp = Math.floor(Date.now() / 1000);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = { sub: user.id, iss: `${upstream}/auth/v1`, aud: 'authenticated', role: 'authenticated',
    aal: assurance, session_id: sessionId, iat: timestamp, exp: timestamp + 3600,
    amr: (assurance === 'aal2' ? [signInMethod, 'totp'] : [signInMethod]).map((method) => ({ method, timestamp })) };
  const jwt = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}`;
  const accessToken = `${jwt}.${createHmac('sha256', signingKey).update(jwt).digest('base64url')}`;
  issued.set(accessToken, { actor, user, sessionId, assurance, signInMethod, signedOut: false });
  return { user, access_token: accessToken, refresh_token: `fixture-refresh-${actor}`, expires_in: 3600, token_type: 'bearer' };
}

async function requestBody(req) {
  return JSON.parse(await Array.fromAsync(req).then((chunks) => Buffer.concat(chunks)));
}

function fixtureUser(actor, email) {
  return { id: userIds[actor], email, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
    factors: actor === 'second' && secondHasTotp ? secondFactors : [], email_confirmed_at: new Date().toISOString(), created_at: new Date().toISOString() };
}

try {
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1',
    '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', privateKeyPath, '-out', certificatePath,
  ], { stdio: 'ignore' });
  const cert = await readFile(certificatePath);
  const certPin = createHash('sha256').update(new X509Certificate(cert).publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
  fixture = createHttpsServer({ cert, key: await readFile(privateKeyPath) }, async (req, res) => {
    const url = new URL(req.url, upstream);
    const reply = (status, body) => {
      if (res.destroyed) return;
      res.writeHead(status, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': startURL,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, x-supabase-api-version, content-type',
        'Cache-Control': 'no-store',
      });
      res.end(body === undefined ? '' : JSON.stringify(body));
    };
    try {
      if (req.method === 'OPTIONS') return reply(204);
      const bearer = req.headers.authorization?.replace(/^Bearer /, '');
      if (url.pathname === '/auth/v1/token' && req.method === 'POST' && url.searchParams.get('grant_type') === 'password') {
        const input = await requestBody(req);
        const actor = input.email === 'first@example.test' ? 'first' : input.email === 'second@example.test' ? 'second' : null;
        if (!actor || input.password !== password || req.headers.apikey !== publishableKey) return reply(400, { message: 'Invalid credentials' });
        calls.push({ method: req.method, path: url.pathname, actor });
        return reply(200, issueAuthSession(actor, fixtureUser(actor, input.email), randomUUID(), 'aal1'));
      }
      if (url.pathname === '/auth/v1/otp' && req.method === 'POST') {
        const input = await requestBody(req);
        otpRequests += 1;
        calls.push({ method: req.method, path: url.pathname });
        if (input.email !== 'first@example.test' || input.create_user !== false || input.code_challenge || url.search || req.headers.apikey !== publishableKey) {
          return reply(400, { code: 'unexpected_otp_request' });
        }
        if (otpRequests === 2) return reply(429, { code: 'over_email_send_rate_limit' });
        availableEmailCode = true;
        return reply(200, {});
      }
      if (url.pathname === '/auth/v1/verify' && req.method === 'POST') {
        const input = await requestBody(req);
        calls.push({ method: req.method, path: url.pathname });
        if (!availableEmailCode || input.type !== 'email' || input.email !== 'first@example.test' || input.token !== validEmailCode || req.headers.apikey !== publishableKey) {
          return reply(403, { code: 'otp_expired', message: 'Invalid fixture email code' });
        }
        availableEmailCode = false;
        const hold = heldEmailReply;
        heldEmailReply = undefined;
        if (hold) await hold;
        return reply(200, issueAuthSession('first', fixtureUser('first', input.email), randomUUID(), 'aal1', 'otp'));
      }
      const login = issued.get(bearer);
      const { actor, user, sessionId, assurance, signInMethod, signedOut } = login ?? {};
      calls.push({ method: req.method, path: url.pathname, actor, assurance, signInMethod, scope: url.searchParams.get('scope') });
      if (!actor || signedOut) return reply(401, { error: 'UNAUTHENTICATED' });
      if (url.pathname === '/auth/v1/logout' && req.method === 'POST') {
        for (const issuedSession of issued.values()) {
          if (issuedSession.sessionId === sessionId) issuedSession.signedOut = true;
        }
        return reply(204);
      }
      if (url.pathname === '/auth/v1/user' && req.method === 'GET') return reply(200, user);
      if (url.pathname === challengePath && req.method === 'POST' && user.factors.includes(verifiedFactor) && assurance === 'aal1') {
        const id = randomUUID();
        challenges.set(id, bearer);
        return reply(200, { id, type: 'totp', expires_at: Math.floor(Date.now() / 1000) + 60 });
      }
      if (url.pathname === verifyPath && req.method === 'POST' && user.factors.includes(verifiedFactor) && assurance === 'aal1') {
        const input = await requestBody(req);
        const challengedBearer = challenges.get(input.challenge_id);
        challenges.delete(input.challenge_id);
        if (challengedBearer !== bearer || input.code !== validCode) {
          return reply(400, { code: 'mfa_verification_failed', message: 'Invalid fixture code' });
        }
        const hold = heldTotpReply;
        heldTotpReply = undefined;
        if (hold) await hold;
        return reply(200, issueAuthSession(actor, user, sessionId, 'aal2', signInMethod));
      }
      if (url.pathname.startsWith('/v1/accounts') && actor === 'second' && assurance !== 'aal2') {
        return reply(403, { error: 'MFA_REQUIRED' });
      }
      if (url.pathname === '/v1/accounts' && req.method === 'GET' && !url.search) {
        if (actor === 'second' && heldCreatedAccountList) await heldCreatedAccountList;
        return reply(200, { items: accounts[actor] });
      }
      if (url.pathname === '/v1/accounts' && req.method === 'POST' && !url.search) {
        const { name, ...extra } = await requestBody(req);
        if (actor !== 'second' || name !== 'Mitt nya privatkonto' || Object.keys(extra).length || req.headers.origin || req.headers.cookie) {
          return reply(400, { error: 'INVALID_INPUT' });
        }
        const existing = accounts.second.find(item => item.kind === 'personal');
        const created = existing ?? { id: createdPersonalId, name, kind: 'personal', role: 'owner' };
        if (!existing) accounts.second = [created, ...accounts.second];
        if (loseAccountCreationReply) { loseAccountCreationReply = false; return reply(503, { error: 'UNAVAILABLE' }); }
        if (heldAccountCreationReply) await heldAccountCreationReply;
        return reply(201, { id: created.id, kind: created.kind, name: created.name });
      }
      const orderAccount = /^\/v1\/accounts\/([^/]+)\/orders$/.exec(url.pathname)?.[1];
      if (orderAccount && req.method === 'GET' && url.search === '?limit=10') {
        if (!accounts[actor].some(({ id, role }) => id === orderAccount && role !== 'driver')) return reply(403, { error: 'FORBIDDEN' });
        if (orderAccount === personal.id && heldOrderReply) await heldOrderReply;
        const order = orderAccount === personal.id
          ? { id: privateOrder, state: privateOrderState, checkout_url: 'https://checkout.invalid/private-only' }
          : { id: companyOrder, state: 'paid', quantity: 1, agreement: { amount_minor: 12345, currency: 'sek', email: 'fixture-only@example.test' } };
        return reply(200, { items: [{ ...order, created_at: '2026-11-21T10:00:00Z' }], nextCursor: null });
      }
      const sessionPath = /^\/v1\/accounts\/([^/]+)\/sessions(?:\/([^/]+))?$/.exec(url.pathname);
      if (sessionPath && req.method === 'GET') {
        const [, accountId, sessionId] = sessionPath;
        if (!accounts[actor].some(({ id }) => id === accountId)) return reply(403, { error: 'FORBIDDEN' });
        const id = accountId === personal.id ? personalSession : companySession;
        const session = { id, status: accountId === personal.id ? 'uncertain' : 'completed',
          created_at: '2026-11-21T10:00:00Z', updated_at: '2026-11-21T11:00:00Z',
          provider_session_id: 'never-show-fixture-provider-session' };
        if (!sessionId && url.search === '?limit=10') {
          return reply(200, { items: accountsWithoutSessions.has(accountId) ? [] : [session], nextCursor: null });
        }
        if (sessionId !== id || url.search) return reply(404, { error: 'NOT_FOUND' });
        if (id === personalSession && heldSessionReply) await heldSessionReply;
        return reply(200, session);
      }
      const vehicleAccount = /^\/v1\/accounts\/([^/]+)\/vehicles$/.exec(url.pathname)?.[1];
      if (vehicleAccount && req.method === 'GET' && url.searchParams.get('limit') === '25') {
        if (!accounts[actor].some(({ id }) => id === vehicleAccount)) return reply(403, { error: 'FORBIDDEN' });
        const next = url.searchParams.get('after');
        if (next !== null && next !== vehicleCursor) return reply(400, { error: 'INVALID_CURSOR' });
        const items = next ? [{ id: '99999999-9999-4999-8999-999999999999', country: 'SE', plate: 'FLE 246', verified_at: null }]
          : Array.from({ length: 25 }, (_, index) => ({ id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`,
            country: 'SE', plate: index ? `EXA ${100 + index}` : 'FLE 123', verified_at: '2026-11-20T10:00:00.000Z' }));
        return reply(200, { items, nextCursor: next ? null : vehicleCursor });
      }
      const productAccount = /^\/v1\/accounts\/([^/]+)\/product-access$/.exec(url.pathname)?.[1];
      if (productAccount && req.method === 'POST' && !url.search) {
        if (!accounts[actor].some(({ id, role }) => id === productAccount && role === 'owner')) return reply(403, { error: 'FORBIDDEN' });
        const input = await requestBody(req);
        if (productAccount !== company.id || input.productKey !== 'charging_subscription' || req.headers.origin || req.headers.cookie) {
          return reply(400, { error: 'INVALID_INPUT' });
        }
        const { requests } = productAccess.get(productAccount);
        if (!requests.some(({ product_key }) => product_key === input.productKey)) {
          requests.push({ product_key: input.productKey, requested_at: '2026-11-22T10:00:00Z' });
        }
        return reply(202, { requested: true, productKey: input.productKey });
      }
      if (productAccount && req.method === 'GET' && !url.search) {
        if (!accounts[actor].some(({ id }) => id === productAccount)) return reply(403, { error: 'FORBIDDEN' });
        const planned = nextProductReply.get(productAccount);
        nextProductReply.delete(productAccount);
        if (planned) {
          const failure = await planned;
          if (failure) return reply(503, { error: 'PRODUCT_ACCESS_UNAVAILABLE' });
        }
        return reply(200, productAccess.get(productAccount));
      }
      return reply(404, { error: 'UNEXPECTED_FIXTURE_ROUTE' });
    } catch {
      return reply(500, { error: 'FIXTURE_ERROR' });
    }
  });
  fixture.listen(0, host);
  await once(fixture, 'listening');
  upstream = `https://${host}:${fixture.address().port}`;
  const [enabledPort, disabledPort, passwordOnlyPort, driverPort] = await Promise.all(Array.from({ length: 4 }, portAvailable));
  const nextBin = resolve('node_modules/next/dist/bin/next');
  const nextEnv = (enabled, emailOtp = false) => ({
    ...process.env, NODE_ENV: 'production', NODE_EXTRA_CA_CERTS: certificatePath,
    FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW: String(enabled), FLEXEXA_CUSTOMER_AUTH_URL: upstream,
    FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW: String(emailOtp),
    FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY: publishableKey, FLEXEXA_CUSTOMER_API_URL: upstream,
  });
  // Next compiles the Auth origin into the production response headers at build time.
  execFileSync(process.execPath, [nextBin, 'build'], { env: nextEnv(true, true), stdio: 'inherit' });
  const launchNext = (port, enabled, emailOtp = false) => {
    const nextAlive = launch(process.execPath, [nextBin, 'start', '--hostname', host, '--port', String(port)], {
      env: nextEnv(enabled, emailOtp),
    });
    const base = `http://${host}:${port}`;
    return pending(async () => {
      nextAlive();
      try {
        const response = await request(base);
        await response.body?.cancel();
        return response.ok;
      } catch { return false; }
    }).then(() => base);
  };
  startURL = await launchNext(enabledPort, true, true);
  const enabledNext = childProcesses.at(-1);
  const previewHeaders = await request(startURL + overview);
  assert.equal(previewHeaders.headers.get('content-security-policy')?.split('; ').find(part => part.startsWith('connect-src ')),
    `connect-src 'self' ${upstream}`);
  await previewHeaders.body?.cancel();
  const disabled = await launchNext(disabledPort, false);
  const passwordOnly = await launchNext(passwordOnlyPort, true);
  const passwordOnlyPage = await request(passwordOnly + overview);
  assert.equal(passwordOnlyPage.status, 200);
  const passwordOnlyHtml = await passwordOnlyPage.text();
  assert.match(passwordOnlyHtml, /Lösenord/);
  assert.doesNotMatch(passwordOnlyHtml, /Logga in med e-postkod/);
  for (const base of [passwordOnly, disabled]) {
    const help = await request(base + loginHelp + '?next=https%3A%2F%2Foutside.invalid');
    assert.equal(help.status, 200);
    const html = await help.text();
    assert.match(html, /Kontaktuppgifter/);
    assert.doesNotMatch(html, /Logga in med e-postkod|href="https:\/\/outside\.invalid/);
  }
  const unavailableEmailMode = await request(passwordOnly + overview + '?inloggning=epostkod');
  assert.match(await unavailableEmailMode.text(), /Lösenord/);
  const hostileQuery = '?next=https%3A%2F%2Foutside.invalid&code=ignored-fixture';
  assertPortalRedirect(await request(disabled + '/app/konto' + hostileQuery), portal);
  assertPortalRedirect(await request(disabled + overview + hostileQuery), portal);
  assertPortalRedirect(await request(disabled + '/app/produkter' + hostileQuery), `${portal}produkter`);
  const enabled = await request(startURL + '/app/konto' + hostileQuery);
  assertPortalRedirect(enabled, overview);
  assertPortalRedirect(await request(startURL + '/app/produkter' + hostileQuery), `${overview}#produkter`);
  const productApi = `/api/kundkonto/${personal.id}/produkter`;
  for (const [base, path, status] of [[startURL, '/api/kundkonto', 401], [startURL, productApi, 401], [disabled, productApi, 404]]) {
    const unavailable = await request(base + path);
    assert.equal(unavailable.status, status);
    assert.match(unavailable.headers.get('cache-control') ?? '', /\bno-store\b/);
  }
  assert.equal(calls.length, 0, 'Unauthenticated HTTP and portal routes must stay local to Next');

  const driver = process.env.CHROMEDRIVER || join(process.env.CHROMEWEBDRIVER || '/usr/local/share/chromedriver-linux64', 'chromedriver');
  const driverAlive = launch(driver, [`--port=${driverPort}`, `--allowed-ips=${host}`]);
  webdriver = async (path, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await request(`http://${host}:${driverPort}${path}`, {
      method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    const { value } = await response.json();
    assert.ok(response.ok && !value?.error, `WebDriver ${method} ${path} ${value?.error ?? response.status}`);
    return value;
  };
  await pending(async () => {
    driverAlive();
    try { return (await webdriver('/status')).ready; } catch { return false; }
  });
  const browser = await webdriver('/session', { capabilities: { alwaysMatch: {
    browserName: 'chrome', 'goog:chromeOptions': {
      ...(process.env.CHROME_BINARY ? { binary: process.env.CHROME_BINARY } : {}),
      args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking', `--ignore-certificate-errors-spki-list=${certPin}`],
    }, timeouts: { pageLoad: 15000, script: 5000, implicit: 0 },
  } } });
  session = `/session/${browser.sessionId}`;
  const browserCommand = (path, body) => webdriver(session + path, body);
  const execute = (script, ...args) => browserCommand('/execute/sync', { script, args });
  const text = () => execute('return document.body.innerText;');
  const viewport = (width, height, mobile) => browserCommand('/goog/cdp/execute', {
    cmd: 'Emulation.setDeviceMetricsOverride', params: { width, height, deviceScaleFactor: 1, mobile },
  });
  const elementKey = 'element-6066-11e4-a52e-4f735466cecf';
  const enter = async (label, value) => {
    const element = await execute('return [...document.querySelectorAll("label")].find(label => label.innerText.trim() === arguments[0])?.control;', label);
    assert.ok(element?.[elementKey], `Missing form control ${label}`);
    await browserCommand(`/element/${element[elementKey]}/value`, { text: value });
  };
  const clickButton = async (label, keyboard = false) => {
    const element = await execute(`const button = [...document.querySelectorAll('button')]
      .find(button => (button.getAttribute('aria-label') ?? button.innerText.trim()) === arguments[0]);
      button?.scrollIntoView({block:'center', behavior:'instant'});
      return button;`, label);
    assert.ok(element?.[elementKey], `Missing button ${label}`);
    if (keyboard) await browserCommand(`/element/${element[elementKey]}/value`, { text: '\uE007' });
    else await browserCommand(`/element/${element[elementKey]}/click`, {});
  };
  const clickHelpLink = async label => {
    const element = await execute('return [...document.querySelectorAll("main a")].find(link => link.textContent.trim() === arguments[0]);', label);
    assert.ok(element?.[elementKey], `Missing help link ${label}`);
    await browserCommand(`/element/${element[elementKey]}/value`, { text: '\uE007' });
  };
  const assertFallback = async () => {
    const fallback = await execute('return [...document.links].find(link => link.innerText.trim() === "Öppna kundportalen")?.href;');
    assert.equal(fallback, portal, 'The account overview must expose the fixed portal fallback');
  };
  const login = async (actor) => {
    await pending(() => execute('return Boolean(document.querySelector("main form button[type=submit]:enabled"));'));
    await enter('E-post', `${actor}@example.test`);
    await enter('Lösenord', password);
    await clickButton('Logga in');
  };
  const assertNoStorage = async () => {
    const persisted = await execute('return JSON.stringify({local: {...localStorage}, session: {...sessionStorage}, cookies: document.cookie});');
    for (const token of [...issued.keys(), 'fixture-refresh-', password, incorrectCode, validCode, validEmailCode, privateOrder, companyOrder,
      personalSession, companySession,
      'first@example.test', 'second@example.test', ...Object.values(accounts).flatMap(entries => entries.flatMap(({ id, name }) => [id, name]))]) {
      assert.ok(!persisted.includes(token), 'Browser persistence contains credentials or an account record');
    }
    assert.doesNotMatch(persisted, /sb-[^"\s]*-auth-token/);
  };
  const productView = () => execute(`const heading = [...document.querySelectorAll('main h2, main h3')]
    .find(candidate => candidate.textContent.trim() === 'Mina produkter');
    return heading?.closest('section')?.innerText ?? '';`);
  const productsFor = (account) => clickButton(`Visa produkter för ${account.name}`);
  const assertProductView = async (account, charge, energy) => {
    const chargingStatus = new RegExp(`Laddabonnemang\\s+${charge}(?:\\s|$)`);
    const energyStatus = new RegExp(`Energioptimering\\s+${energy}(?:\\s|$)`);
    await pending(async () => {
      const panel = await productView();
      return panel.includes(account.name) && chargingStatus.test(panel) && energyStatus.test(panel);
    });
    const panel = await productView();
    assert.deepEqual(await execute(`return [...document.querySelectorAll('#account-products dt')]
      .map(label => label.textContent.trim());`), ['Laddabonnemang', 'Energioptimering']);
    assert.doesNotMatch(panel, /Grid Rewards|Extern API|product_key|grid_rewards|external_api/);
    const activeAccount = await execute('return document.querySelector("main button[aria-pressed=true]")?.innerText.trim();');
    assert.equal(activeAccount, `Visa produkter för ${account.name}`);
    const handoff = await execute('return [...document.links].find(link => link.innerText.trim() === "Hantera produkter i kundportalen")?.href;');
    assert.equal(handoff, `${portal}produkter`);
  };
  const mfaVisible = async () => (await text()).includes('Tvåstegsverifiering');
  const submitCode = async (code) => {
    await enter('Sexsiffrig kod', code);
    await clickButton('Bekräfta kod');
  };
  const businessCalls = () => calls.filter(({ path }) => path.startsWith('/v1/'));

  await viewport(1440, 900, false);
  await browserCommand('/url', { url: startURL + overview });
  await pending(async () => (await text()).includes('Endast nödvändiga'));
  await clickButton('Endast nödvändiga');
  await pending(async () => /Logga in/.test(await text()));
  await assertFallback();
  await clickHelpLink('Hjälp med inloggning');
  await pending(async () => await browserCommand('/url') === startURL + loginHelp);
  assert.equal(await execute('return document.querySelector("main h1").textContent.trim();'), 'Hjälp med inloggning');
  assert.deepEqual(await execute('return [...document.querySelectorAll("main a")].map(link => link.getAttribute("href"));'),
    [`${overview}?inloggning=epostkod`, '/kontakt', overview]);
  await clickHelpLink('Logga in med e-postkod');
  await pending(async () => (await text()).includes('Skicka kod'));
  assert.equal(await execute('return document.querySelector("#account-otp-email").value;'), '');
  assert.equal(otpRequests, 0, 'Opening account help and choosing email code must not send a code');
  await clickButton('Avbryt');
  await pending(async () => (await text()).includes('Lösenord'));
  verified.push('keyboard account help keeps the same environment, with OTP off and on and no automatic credential request');
  await login('first');
  await pending(async () => /Mina konton[\s\S]*Konto Grön/.test(await text()));
  assert.match(await text(), /Konto Grön · Privat · Ägare/);
  assert.doesNotMatch(await text(), /Skapa privatkonto/);
  assert.doesNotMatch(await text(), /Konto Blå/);
  assert.equal(await execute('return document.querySelector("main h2")?.textContent?.trim();'), 'Mina konton');
  const delayedProduct = Promise.withResolvers();
  nextProductReply.set(personal.id, delayedProduct.promise);
  try {
    await productsFor(personal);
    await pending(() => calls.some(({ path, actor }) => path === productPath(personal) && actor === 'first'));
    assert.match(await productView(), /Konto Grön[\s\S]*Hämtar produkter/);
    await productsFor(company);
    await assertProductView(company, 'Begärd', 'Aktiv');
  } finally {
    delayedProduct.resolve(false);
  }
  await browserCommand('/execute/async', {
    script: 'const done = arguments[arguments.length - 1]; requestAnimationFrame(() => requestAnimationFrame(done));', args: [],
  });
  await assertProductView(company, 'Begärd', 'Aktiv');
  await productsFor(personal);
  await assertProductView(personal, 'Aktiv', 'Ingen åtkomst');
  await assertNoStorage();
  await clickButton('Logga ut');
  await pending(async () => /Logga in/.test(await text()) && !/Konto Grön/.test(await text()));
  assert.doesNotMatch(await productView(), /Konto Grön|Konto Guld|Laddabonnemang|Energioptimering/);
  await assertNoStorage();
  await pending(() => calls.some(({ path, actor, scope }) => path === '/auth/v1/logout' && actor === 'first' && scope === 'local'));
  verified.push('desktop password sign-in, account switching with a delayed product reply, session-local logout and storage');

  await viewport(390, 844, true);
  await login('second');
  await pending(async () => (await text()).includes('Inloggningen behöver bekräftas. Se Hjälp med inloggning för dina alternativ.'));
  assert.doesNotMatch(await text(), /Konto Grön|Konto Blå/);
  await assertFallback();
  await assertNoStorage();
  assert.ok(!calls.some(({ path }) => path.startsWith('/auth/v1/factors/')), 'Unsupported MFA never creates a challenge');
  await clickHelpLink('Hjälp med inloggning');
  await pending(async () => await browserCommand('/url') === startURL + loginHelp);
  assert.equal(await execute('return [...document.querySelectorAll("main a")].find(link => link.textContent.trim() === "Kontaktuppgifter")?.getAttribute("href");'), '/kontakt');
  secondHasTotp = true;
  await browserCommand('/url', { url: startURL + overview });
  await pending(async () => /Logga in/.test(await text()));
  await login('second');
  await pending(mfaVisible);
  assert.doesNotMatch(await text(), /Mina konton|Konto Grön|Konto Guld|Konto Blå/);
  let pendingBusinessCalls = businessCalls().length;
  await submitCode(incorrectCode);
  await pending(async () => (await text()).includes('Koden kunde inte bekräftas. Försök igen.'));
  assert.equal(businessCalls().length, pendingBusinessCalls, 'Wrong TOTP code must not read accounts or products');
  await assertNoStorage();

  const delayedTotp = Promise.withResolvers();
  heldTotpReply = delayedTotp.promise;
  try {
    await submitCode(validCode);
    await pending(() => calls.filter(({ path }) => path === verifyPath).length === 2);
    assert.doesNotMatch(await text(), /Mina konton|Konto Grön|Konto Guld|Konto Blå/);
    await clickButton('Avbryt');
    await pending(async () => /Logga in/.test(await text()) && !(await mfaVisible()));
  } finally {
    delayedTotp.resolve();
  }
  await pending(() => calls.some(({ path, actor, assurance, scope }) =>
    path === '/auth/v1/logout' && actor === 'second' && assurance === 'aal2' && scope === 'local'));
  assert.equal(businessCalls().length, pendingBusinessCalls, 'A delayed TOTP reply after cancellation must not read accounts');
  assert.doesNotMatch(await text(), /Mina konton|Konto Grön|Konto Guld|Konto Blå/);
  await assertNoStorage();

  await login('second');
  await pending(mfaVisible);
  pendingBusinessCalls = businessCalls().length;
  await submitCode(validCode);
  await pending(async () => /Mina konton[\s\S]*Konto Blå/.test(await text()));
  assert.equal(businessCalls().length, pendingBusinessCalls + 1);
  assert.equal(businessCalls().at(-1).assurance, 'aal2');
  const latestAccountRead = calls.findLastIndex(({ path }) => path === '/v1/accounts');
  assert.ok(calls.slice(0, latestAccountRead).some(({ path, assurance, actor }) => path === '/auth/v1/user' && assurance === 'aal2' && actor === 'second'));
  assert.match(await text(), /Konto Blå · Företag · Ekonomi/);
  assert.doesNotMatch(await text(), /Konto Grön|Konto Guld/);
  assert.doesNotMatch(await productView(), /Konto Grön|Konto Guld|Laddabonnemang|Energioptimering/);
  nextProductReply.set(otherCompany.id, Promise.resolve(true));
  await productsFor(otherCompany);
  await pending(async () => (await text()).includes('Produkterna kunde inte hämtas. Försök igen eller öppna kundportalen.'));
  assert.doesNotMatch(await productView(), /Laddabonnemang|Energioptimering/);
  await clickButton('Försök igen');
  await assertProductView(otherCompany, 'Indragen', 'Ej tillgänglig');
  assert.equal(await execute('return document.documentElement.scrollWidth <= window.innerWidth;'), true);
  await assertNoStorage();
  await browserCommand('/refresh', {});
  await pending(async () => /Logga in/.test(await text()) && !/Konto Blå/.test(await text()));
  assert.doesNotMatch(await productView(), /Konto Blå|Laddabonnemang|Energioptimering/);
  assert.deepEqual(businessCalls().map(({ method, path, actor, assurance }) => [method, path, actor, assurance]), [
    ['GET', '/v1/accounts', 'first', 'aal1'], ['GET', productPath(personal), 'first', 'aal1'], ['GET', productPath(company), 'first', 'aal1'],
    ['GET', productPath(personal), 'first', 'aal1'], ['GET', '/v1/accounts', 'second', 'aal1'], ['GET', '/v1/accounts', 'second', 'aal1'],
    ['GET', '/v1/accounts', 'second', 'aal1'], ['GET', '/v1/accounts', 'second', 'aal2'],
    ['GET', productPath(otherCompany), 'second', 'aal2'], ['GET', productPath(otherCompany), 'second', 'aal2'],
  ]);
  assert.deepEqual(calls.filter(({ path }) => path.startsWith('/auth/v1/factors/')).map(({ method, path }) => [method, path]), [
    ['POST', challengePath], ['POST', verifyPath], ['POST', challengePath], ['POST', verifyPath], ['POST', challengePath], ['POST', verifyPath],
  ]);
  verified.push('mobile MFA fallback, wrong code, late cancellation, AAL2 account and product reads, and reload');

  await login('first');
  await pending(async () => /Mina konton[\s\S]*Konto Grön/.test(await text()));
  const delayedOrders = Promise.withResolvers();
  heldOrderReply = delayedOrders.promise;
  try {
    await clickButton(`Visa beställningar för ${personal.name}`);
    await pending(async () => (await text()).includes('Hämtar beställningar'));
    await clickButton(`Visa fordon för ${company.name}`);
    await pending(async () => (await text()).includes('FLE 123'));
  } finally {
    delayedOrders.resolve();
    heldOrderReply = null;
  }
  await clickButton('Visa fler fordon');
  await pending(async () => (await text()).includes('FLE 246'));
  assert.match(await text(), /FLE 123/);
  assert.doesNotMatch(await text(), new RegExp(privateOrder));
  await clickButton(`Visa beställningar för ${company.name}`);
  await pending(async () => (await text()).includes(companyOrder));
  assert.match(await text(), /Betald.*123,45/);
  assert.doesNotMatch(await text(), /FLE 123|checkout\.invalid|fixture-only@example\.test/);
  const orderContinuation = () => execute(`const link = [...document.querySelectorAll('#account-orders a')]
    .find(element => element.textContent.trim() === 'Öppna beställningen i kundportalen');
    return link ? { href: link.href, referrerPolicy: link.referrerPolicy,
      reference: document.getElementById(link.getAttribute('aria-describedby'))?.textContent } : null;`);
  assert.equal(await orderContinuation(), null);
  await clickButton(`Visa beställningar för ${personal.name}`);
  await pending(async () => (await text()).includes(privateOrder));
  assert.match(await text(), /Väntar på betalning/);
  assert.doesNotMatch(await text(), new RegExp(`${companyOrder}|checkout\\.invalid`));
  assert.deepEqual(await orderContinuation(), { href: `${portal}bestallningar?order=${privateOrder}`,
    referrerPolicy: 'no-referrer', reference: `Referens ${privateOrder}` });
  const delayedRefresh = Promise.withResolvers();
  heldOrderReply = delayedRefresh.promise;
  try {
    privateOrderState = 'paid';
    await clickButton('Uppdatera beställningar', true);
    await pending(async () => (await text()).includes('Hämtar beställningar'));
    assert.equal(await orderContinuation(), null);
    assert.equal(await execute('return document.activeElement.textContent.trim();'), 'Uppdatera beställningar');
  } finally {
    delayedRefresh.resolve();
    heldOrderReply = null;
  }
  await pending(async () => /Betald[\s\S]*Referens 77777777/.test(await text()));
  assert.equal(await orderContinuation(), null);
  verified.push('private order continuation and keyboard refresh of backend-confirmed payment status');
  const membershipsBeforeDenial = accounts.first;
  const accountReadCount = () => businessCalls().filter(({ path, actor }) => path === '/v1/accounts' && actor === 'first').length;
  try {
    const beforeRoleChange = accountReadCount();
    accounts.first = [personal, { ...company, role: 'driver' }];
    await clickButton(`Visa beställningar för ${company.name}`);
    await pending(async () => (await text()).includes(`${company.name} · Företag · Förare`));
    assert.equal(accountReadCount(), beforeRoleChange + 1);
    assert.equal(await execute('return document.activeElement.textContent.trim();'), 'Mina konton');
    assert.doesNotMatch(await text(), new RegExp(`Visa beställningar för ${company.name}|${privateOrder}|${companyOrder}`));
    const beforeRemoval = accountReadCount();
    accounts.first = [personal];
    await clickButton(`Visa fordon för ${company.name}`);
    await pending(async () => (await text()).includes('Kontolistan har hämtats på nytt.') && !(await text()).includes(company.name));
    assert.equal(accountReadCount(), beforeRemoval + 1);
    assert.doesNotMatch(await text(), /FLE 123|FLE 246/);
  } finally {
    accounts.first = membershipsBeforeDenial;
  }
  verified.push('denied account reads immediately revalidate role and membership');
  await clickButton('Uppdatera');
  await pending(async () => (await text()).includes(company.name));
  await clickButton(`Visa laddningar för ${personal.name}`, true);
  await pending(async () => (await text()).includes(personalSession));
  assert.match(await text(), /Status behöver stämmas av/);
  const delayedSession = Promise.withResolvers();
  heldSessionReply = delayedSession.promise;
  try {
    await clickButton('Visa laddning', true);
    await pending(() => businessCalls().some(({ path }) => path.endsWith(`/sessions/${personalSession}`)));
    await clickButton(`Visa laddningar för ${company.name}`);
    await pending(async () => (await text()).includes(companySession));
  } finally {
    delayedSession.resolve();
    heldSessionReply = null;
  }
  await clickButton('Visa laddning', true);
  await pending(async () => /Laddningsdetaljer[\s\S]*Senast uppdaterad/.test(await text()));
  assert.equal(await execute('return document.activeElement.textContent.trim();'), 'Laddningsdetaljer');
  assert.match(await text(), /Avslutad/);
  assert.doesNotMatch(await text(), new RegExp(`${personalSession}|never-show-fixture-provider-session|Stoppa laddning`));
  await clickButton('Tillbaka till senaste laddningar');
  await pending(async () => /Senaste laddningar/.test(await text()) && (await text()).includes(companySession));
  await assertNoStorage();
  verified.push('account-scoped recent charging and details, keyboard access and stale cross-account replies discarded');

  try {
    accountsWithoutSessions.add(company.id);
    await clickButton('Uppdatera laddningar', true);
    await pending(async () => (await text()).includes('Det finns inga laddningar att visa på kontot.'));
    assert.doesNotMatch(await text(), new RegExp(`${personalSession}|${companySession}`));
    accountsWithoutSessions.delete(company.id);
    await clickButton('Uppdatera laddningar', true);
    await pending(async () => (await text()).includes(companySession));
    const beforeSessionRoleRevoked = accountReadCount();
    accounts.first = [personal];
    await clickButton('Uppdatera laddningar', true);
    await pending(async () => (await text()).includes('Kontolistan har hämtats på nytt.') && !(await text()).includes(company.name));
    assert.equal(accountReadCount(), beforeSessionRoleRevoked + 1);
    assert.doesNotMatch(await text(), new RegExp(`Senaste laddningar|Laddningsdetaljer|${personalSession}|${companySession}`));
  } finally {
    accountsWithoutSessions.delete(company.id);
    accounts.first = membershipsBeforeDenial;
  }
  verified.push('mobile charging history empty state and immediate clearing after Commerce denies a removed membership');
  await clickButton('Logga ut');
  await pending(async () => /Logga in/.test(await text()) && !(await text()).includes(personal.name));
  await assertNoStorage();
  verified.push('scoped order status, stale response fencing and paginated vehicles');

  const emailNotice = 'Om adressen har ett konto och en kod kan skickas får du ett mejl.';
  const startEmailLogin = async () => {
    await clickButton('Logga in med e-postkod');
    await enter('E-post', 'FIRST@example.test');
    await clickButton('Skicka kod');
    await pending(async () => (await text()).includes(emailNotice));
  };
  const verifyEmailCode = async (code) => {
    await enter('Kod från e-post', code);
    await clickButton('Bekräfta e-postkod');
  };
  const emailOtpStart = businessCalls().length;
  await execute(`const nativeTimeout = window.setTimeout;
    window.setTimeout = (callback, timeout, ...args) => {
      const id = nativeTimeout(callback, timeout, ...args);
      if (timeout >= 59_000 && timeout <= 60_000) {
        window.setTimeout = nativeTimeout;
        window.finishOtpCooldown = () => { clearTimeout(id); callback(...args); };
      }
      return id;
    };`);
  await startEmailLogin();
  assert.equal(otpRequests, 1);
  assert.equal(await execute(`return [...document.querySelectorAll('main button')]
    .find(button => button.textContent === 'Skicka ny kod')?.disabled;`), true);
  assert.doesNotMatch(await text(), /Mina konton|Konto Blå|Konto Grön/);
  await assertNoStorage();
  await execute('window.finishOtpCooldown();');
  await pending(() => execute(`return [...document.querySelectorAll('main button')]
    .some(button => button.textContent === 'Skicka ny kod' && !button.disabled);`));
  await clickButton('Skicka ny kod');
  await pending(async () => otpRequests === 2 && (await text()).includes(emailNotice));
  await verifyEmailCode(incorrectCode);
  await pending(async () => (await text()).includes('Koden kunde inte bekräftas. Försök igen.'));
  assert.equal(businessCalls().length, emailOtpStart);
  assert.equal(await execute(`return document.querySelector('#account-email-code')?.value;`), '');

  const delayedEmail = Promise.withResolvers();
  heldEmailReply = delayedEmail.promise;
  try {
    await verifyEmailCode(validEmailCode);
    await pending(() => calls.filter(({ path }) => path === '/auth/v1/verify').length === 2);
    await clickButton('Avbryt');
    await pending(async () => /Logga in/.test(await text()) && !(await text()).includes('Bekräfta e-postkoden'));
    await clickButton('Logga in med e-postkod');
    assert.equal(await execute(`return [...document.querySelectorAll('main button')]
      .find(button => button.textContent === 'Skicka kod')?.disabled;`), true);
  } finally {
    delayedEmail.resolve();
  }
  await pending(() => calls.some(({ path, actor, signInMethod, scope }) =>
    path === '/auth/v1/logout' && actor === 'first' && signInMethod === 'otp' && scope === 'local'));
  assert.equal(businessCalls().length, emailOtpStart, 'A cancelled email verification must not read accounts');
  await assertNoStorage();

  await browserCommand('/refresh', {});
  await pending(async () => (await text()).includes('Logga in med e-postkod'));
  await startEmailLogin();
  await verifyEmailCode(validEmailCode);
  await pending(async () => /Mina konton[\s\S]*Konto Grön/.test(await text()));
  assert.doesNotMatch(await text(), /Konto Blå/);
  assert.deepEqual(businessCalls().slice(emailOtpStart).map(({ path, actor, signInMethod }) => [path, actor, signInMethod]), [
    ['/v1/accounts', 'first', 'otp'],
  ]);
  assert.equal(new URL(await browserCommand('/url')).search, '');
  assert.equal(otpRequests, 3);
  await assertNoStorage();
  const requestStart = businessCalls().length;
  productAccess.get(company.id).requests.length = 0;
  await productsFor(company);
  await assertProductView(company, 'Ingen åtkomst', 'Aktiv');
  await clickButton('Begär åtkomst till Laddabonnemang', true);
  await assertProductView(company, 'Begärd', 'Aktiv');
  assert.equal(await execute('return document.activeElement.id;'), 'account-products-title');
  assert.ok(!(await productView()).includes('Begär åtkomst till Laddabonnemang'));
  assert.deepEqual(businessCalls().slice(requestStart).map(({ method, path, actor }) => [method, path, actor]), [
    ['GET', productPath(company), 'first'], ['POST', productPath(company), 'first'], ['GET', productPath(company), 'first'],
  ]);
  verified.push('owner submits a product request and sees the backend-confirmed pending state');
  await clickButton('Logga ut');
  await pending(async () => /Logga in/.test(await text()) && !/Konto Grön/.test(await text()));
  await pending(() => calls.filter(({ path, actor, signInMethod, scope }) =>
    path === '/auth/v1/logout' && actor === 'first' && signInMethod === 'otp' && scope === 'local').length === 2);
  await assertNoStorage();
  verified.push('opt-in email OTP, throttled resend, wrong code, stale verification cleanup and correct account');

  const workerPath = () => execute(`return navigator.serviceWorker.controller
    ? new URL(navigator.serviceWorker.controller.scriptURL).pathname : null;`);
  const setOffline = (offline) => browserCommand('/goog/cdp/execute', {
    cmd: 'Network.emulateNetworkConditions', params: { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
  });
  const cacheNames = () => browserCommand('/execute/async', {
    script: 'const done = arguments[arguments.length - 1]; caches.keys().then(done);', args: [],
  });
  await pending(async () => await workerPath() === '/service-worker.js');
  const registration = await browserCommand('/execute/async', {
    script: `const done = arguments[arguments.length - 1]; navigator.serviceWorker.ready.then(worker =>
      done({scope: worker.scope, state: worker.active?.state, updateViaCache: worker.updateViaCache}));`, args: [],
  });
  assert.deepEqual(registration, { scope: `${startURL}/`, state: 'activated', updateViaCache: 'none' });
  const privatePage = await request(startURL + overview);
  assert.match(privatePage.headers.get('cache-control') ?? '', /\bno-store\b/);
  await privatePage.body?.cancel();
  await login('first');
  await pending(async () => /Mina konton[\s\S]*Konto Grön/.test(await text()));
  productAccess.get(company.id).requests.length = 0;
  await productsFor(company);
  await assertProductView(company, 'Ingen åtkomst', 'Aktiv');
  const beforeOffline = businessCalls().length;
  const writesBeforeOffline = businessCalls().filter(({ method }) => method === 'POST').length;
  await setOffline(true);
  try {
    // Page-scoped CDP emulation alone leaves the worker's network reachable.
    const stopped = once(enabledNext, 'exit');
    assert.ok(enabledNext.kill('SIGTERM'));
    await stopped;
    await assert.rejects(request(startURL));
    await pending(() => execute('return navigator.onLine === false;'));
    await clickButton('Begär åtkomst till Laddabonnemang', true);
    await pending(async () => (await productView()).includes('Begäran kunde inte bekräftas.'));
    assert.doesNotMatch(await productView(), /Begärd/);
    await clickButton('Försök igen');
    await pending(async () => (await productView()).includes('Produkterna kunde inte hämtas.'));
    assert.doesNotMatch(await productView(), /Laddabonnemang|Energioptimering/);
    await clickButton('Uppdatera');
    await pending(async () => (await text()).includes('Kontona kunde inte hämtas.'));
    assert.doesNotMatch(await text(), /Konto Grön|Konto Guld|Konto Blå/);
    assert.equal(businessCalls().length, beforeOffline);
    assert.deepEqual(await cacheNames(), []);
    await assertNoStorage();
    await assert.rejects(browserCommand('/url', { url: startURL + overview }));
    await assert.rejects(browserCommand('/url', { url: startURL + '/energi?offline-probe=1' }));
    await assert.rejects(browserCommand('/url', { url: startURL + '/energy-wizard?partner=fixture' }));
    for (const publicPath of ['/energy-wizard', '/energy-wizard/planering']) {
      await browserCommand('/url', { url: startURL + publicPath });
      assert.equal(await execute('return document.querySelector("h1")?.textContent;'), 'Du är offline');
    }
    await browserCommand('/url', { url: startURL + '/ladda' });
    assert.equal(await execute('return document.querySelector("h1")?.textContent;'), 'Du är offline');
    assert.doesNotMatch(await text(), /Mina konton|Konto Grön|Konto Guld|Konto Blå/);
    assert.deepEqual(await cacheNames(), []);
  } finally {
    await setOffline(false);
  }
  assert.equal(await launchNext(enabledPort, true, true), startURL);
  const retry = await execute('return [...document.links].find(link => link.textContent === "Försök igen");');
  assert.ok(retry?.[elementKey], 'Public offline page must offer a retry link');
  await browserCommand(`/element/${retry[elementKey]}/click`, {});
  await pending(() => execute('return navigator.onLine && document.querySelector("h1")?.textContent.startsWith("Mer väg.");'));
  assert.equal(new URL(await browserCommand('/url')).pathname, '/ladda');
  await browserCommand('/url', { url: startURL + overview });
  await pending(async () => /Logga in/.test(await text()));
  assert.doesNotMatch(await text(), /Konto Grön|Konto Guld|Konto Blå/);
  await login('second');
  await pending(mfaVisible);
  await submitCode(validCode);
  await pending(async () => /Mina konton[\s\S]*Konto Blå/.test(await text()));
  await productsFor(otherCompany);
  await assertProductView(otherCompany, 'Indragen', 'Ej tillgänglig');
  assert.doesNotMatch(await text(), /Konto Grön|Konto Guld/);
  assert.equal(businessCalls().filter(({ method }) => method === 'POST').length, writesBeforeOffline, 'Reconnect must not replay an offline product request');
  assert.deepEqual(await cacheNames(), []);
  await assertNoStorage();
  verified.push('public offline fallback, no stored or queued account traffic, and a fresh identity after reconnect');

  await pending(async () => (await text()).includes('Skapa privatkonto'));
  const writesBeforeCreation = businessCalls().filter(({ method }) => method === 'POST').length;
  loseAccountCreationReply = true;
  await enter('Kontonamn', 'Mitt nya privatkonto');
  await clickButton('Skapa privatkonto', true);
  await pending(async () => (await text()).includes('Privatkontot kunde inte bekräftas.'));
  assert.doesNotMatch(await text(), /Ditt privatkonto är klart\./);

  const accountCreationWrites = () => businessCalls().filter(({ method, path }) => method === 'POST' && path === '/v1/accounts').length;
  const createdAccountReads = () => businessCalls().filter(({ method, path, actor }) =>
    method === 'GET' && path === '/v1/accounts' && actor === 'second').length;
  const foregroundAccountPage = async () => {
    assert.equal(await execute("document.dispatchEvent(new Event('visibilitychange')); return document.visibilityState;"), 'visible');
  };
  const writesBeforeRetry = accountCreationWrites();
  const readsBeforeRetry = createdAccountReads();
  const creation = Promise.withResolvers();
  const confirmation = Promise.withResolvers();
  heldAccountCreationReply = creation.promise;
  heldCreatedAccountList = confirmation.promise;
  try {
    await clickButton('Skapa privatkonto', true);
    await pending(() => accountCreationWrites() === writesBeforeRetry + 1);
    await foregroundAccountPage();
    assert.match(await text(), /Skapar privatkonto/);
    creation.resolve();
    await pending(() => createdAccountReads() === readsBeforeRetry + 1);
    await foregroundAccountPage();
  } finally {
    creation.resolve();
    confirmation.resolve();
    heldAccountCreationReply = undefined;
    heldCreatedAccountList = undefined;
  }
  await pending(async () => (await text()).includes('Ditt privatkonto är klart.'));
  assert.equal(createdAccountReads(), readsBeforeRetry + 1, 'Foreground refresh must not replace the creation confirmation');
  assert.match(await text(), /Mitt nya privatkonto · Privat · Ägare/);
  assert.match(await text(), /Konto Blå · Företag · Ekonomi/);
  assert.doesNotMatch(await text(), /Skapa privatkonto|Konto Grön|Konto Guld/);
  assert.equal(businessCalls().filter(({ method }) => method === 'POST').length, writesBeforeCreation + 2);
  assert.equal(accounts.second.filter(item => item.id === createdPersonalId).length, 1);
  await foregroundAccountPage();
  await pending(() => createdAccountReads() === readsBeforeRetry + 2);
  await pending(async () => (await text()).includes('Mitt nya privatkonto · Privat · Ägare'));
  await assertNoStorage();
  verified.push('keyboard personal account setup, safe retry, and membership confirmation across foreground refresh');
  console.log(JSON.stringify({ gate: 'web-customer-account-browser', status: 'passed', browser: browser.capabilities.browserVersion, checks: verified }));
} finally {
  if (session) {
    try { await webdriver(session, undefined, 'DELETE'); } catch { /* Browser processes are stopped below. */ }
  }
  await Promise.all(childProcesses.map(async (child) => {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
    const exit = once(child, 'exit');
    child.kill('SIGTERM');
    await Promise.race([exit, delay(2000, undefined, { ref: false })]);
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }));
  if (fixture?.listening) {
    await new Promise((done) => {
      fixture.close(done);
      fixture.closeAllConnections();
    });
  }
  await rm(scratch, { force: true, recursive: true });
}
