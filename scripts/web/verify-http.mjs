import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertPage, staticAssets, canary } from './http-contract.mjs';
import { verifyBrowser } from './verify-browser.mjs';

// Exercise the actual production build on loopback only. This is an HTTP/asset
// smoke gate, not a browser interaction, Auth, tenant isolation or device test.
const socket = createServer();
socket.listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise((done) => socket.close(done));
const child = spawn(process.execPath, [resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: process.cwd(), stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production', FLEXEXA_SERVER_ONLY_TEST: canary },
});
let spawnFailed = false;
child.on('error', () => { spawnFailed = true; });
const base = `http://127.0.0.1:${port}`;
const request = (path, redirect = 'error') => fetch(new URL(path, base), { redirect, signal: AbortSignal.timeout(5000) });
try {
  let response;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (spawnFailed || child.exitCode !== null) throw new Error('WEB_SERVER_EXIT');
    try { response = await request('/'); if (response.status === 200) break; await response.body?.cancel(); }
    catch { /* Startup only: failures after readiness are never retried. */ }
    await delay(200);
  }
  if (!response || response.status !== 200) throw new Error('WEB_SERVER_NOT_READY');
  const html = await response.text();
  assertPage(response.status, response.headers.get('content-type'), html);
  const worker = await request('/service-worker.js');
  assert.equal(worker.status, 200, 'WEB_SERVICE_WORKER_STATUS');
  assert.match(worker.headers.get('content-type') ?? '', /^(?:text|application)\/javascript\b/i, 'WEB_SERVICE_WORKER_TYPE');
  assert.match(worker.headers.get('cache-control') ?? '', /\bno-cache\b/, 'WEB_SERVICE_WORKER_REVALIDATION');
  await worker.body?.cancel();
  assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"[^>]*>/, 'WEB_MANIFEST_LINK');
  assert.match(html, /<link rel="apple-touch-icon" href="\/icon-192\.png"[^>]*>/, 'WEB_APPLE_ICON_LINK');
  const manifestResponse = await request('/manifest.webmanifest');
  assert.equal(manifestResponse.status, 200, 'WEB_MANIFEST_STATUS');
  assert.match(manifestResponse.headers.get('content-type') ?? '', /^application\/manifest\+json\b/i, 'WEB_MANIFEST_CONTENT_TYPE');
  const manifest = await manifestResponse.json();
  assert.equal(manifest.name, 'Flexexa', 'WEB_MANIFEST_NAME');
  assert.equal(manifest.lang, 'sv', 'WEB_MANIFEST_LOCALE');
  assert.equal(manifest.id, '/', 'WEB_MANIFEST_ID');
  assert.equal(manifest.start_url, '/', 'WEB_MANIFEST_START_URL');
  assert.equal(manifest.scope, '/', 'WEB_MANIFEST_SCOPE');
  assert.equal(manifest.display, 'standalone', 'WEB_MANIFEST_DISPLAY');
  for (const size of [192, 512]) {
    const icon = manifest.icons.find((entry) => entry.sizes === `${size}x${size}`);
    assert.equal(icon?.src, `/icon-${size}.png`, 'WEB_MANIFEST_ICON_PATH');
    assert.equal(icon.type, 'image/png', 'WEB_MANIFEST_ICON_TYPE');
    const image = await request(icon.src);
    assert.equal(image.status, 200, 'WEB_MANIFEST_ICON_STATUS');
    assert.equal(image.headers.get('content-type'), 'image/png', 'WEB_MANIFEST_ICON_CONTENT_TYPE');
    const raw = Buffer.from(await image.arrayBuffer());
    assert.equal(raw.subarray(0, 16).toString('hex'), '89504e470d0a1a0a0000000d49484452', 'WEB_MANIFEST_ICON_PNG_HEADER');
    assert.equal(raw.readUInt32BE(16), size, 'WEB_MANIFEST_ICON_WIDTH');
    assert.equal(raw.readUInt32BE(20), size, 'WEB_MANIFEST_ICON_HEIGHT');
  }
  const assets = staticAssets(html);
  for (const path of assets) {
    const asset = await request(path);
    assert.equal(asset.status, 200, 'WEB_ASSET_HTTP_STATUS');
    const body = await asset.text();
    assert.ok(body.length > 0 && !body.includes(canary), 'WEB_ASSET_CONTENT');
  }
  const missingRoutes = ['/__flexexa_missing_page__', '/api/__flexexa_missing_endpoint__', '/app/__proto__', '/app/okand', '/app/payment-return', '/app/auth/callback'];
  for (const path of missingRoutes) {
    const missing = await request(path);
    assert.equal(missing.status, 404, 'WEB_NEGATIVE_ROUTE');
    await missing.body?.cancel();
  }
  for (const path of ['/energi','/ladda','/elbilsabonnemang','/kontakt','/app','/integritet','/cookies','/villkor','/robots.txt','/sitemap.xml']) {
    const route = await request(path); assert.equal(route.status,200,`WEB_ROUTE_${path}`);
    const body = await route.text();
    assert.ok(!body.includes(canary));
    if (path === '/app') assert.match(body, /INTERAKTIV FÖRHANDSVISNING/, 'WEB_APP_PREVIEW');
  }
  const contactInterests = [
    ['?intresse=energi', 'Smart energistyrning'],
    ['', 'Partnerskap'],
    ['?intresse=okant', 'Partnerskap'],
    ['?intresse=energi&intresse=okant', 'Partnerskap'],
  ];
  for (const [query, expected] of contactInterests) {
    const contact = await request('/kontakt' + query);
    assert.equal(contact.status, 200, 'WEB_CONTACT_ROUTE');
    const choices = (await contact.text()).match(/<select\b[^>]*\bname="interest"[^>]*>([\s\S]*?)<\/select>/)?.[1];
    const selected = choices?.match(/<option\b[^>]*\bselected(?:="[^"]*")?[^>]*>([^<]*)<\/option>/)?.[1];
    assert.equal(selected, expected, `WEB_CONTACT_DEFAULT_INTEREST ${query || 'empty query'}`);
  }
  assert.match(html, /href="\/app\/konto"/, 'WEB_PORTAL_ACCOUNT_LINK');
  const wizard = await request('/energy-wizard');
  assert.equal(wizard.status, 200, 'WEB_ENERGY_WIZARD');
  assert.match(await wizard.text(), /href="\/app\/produkter"/, 'WEB_PORTAL_PRODUCTS_LINK');
  const portalEntries = [
    ['/app/konto', 'https://ladda.flexexa.com/'],
    ['/app/produkter', 'https://ladda.flexexa.com/produkter'],
  ];
  for (const [path, location] of portalEntries) {
    for (const query of ['', '?next=https%3A%2F%2Foutside.invalid%2F&code=local-fixture']) {
      const entry = await request(path + query, 'manual');
      assert.equal(entry.status, 307, 'WEB_PORTAL_REDIRECT_STATUS');
      assert.equal(entry.headers.get('location'), location, 'WEB_PORTAL_REDIRECT_TARGET');
      assert.match(entry.headers.get('cache-control') ?? '', /\bno-store\b/, 'WEB_PORTAL_REDIRECT_NO_CACHE');
      assert.equal(entry.headers.get('set-cookie'), null, 'WEB_PORTAL_REDIRECT_NO_COOKIE');
      assert.equal(entry.headers.get('referrer-policy'), 'strict-origin-when-cross-origin', 'WEB_PORTAL_REDIRECT_REFERRER');
      await entry.body?.cancel();
    }
  }
  if (!process.argv.includes('--http-only')) await verifyBrowser(base);
  const report = { gate: 'web-production-http-v1', status: 'passed', page: true, staticAssets: assets.length,
    negativeRoutes: missingRoutes.length, portalRedirects: portalEntries.length, contactDefaults: contactInterests.length, secretCanaryAbsent: true,
    pwaManifest: true, scope: 'Public shell, manifest, assets, contact defaults and fixed portal redirects. The portal session, commerce API and device operations are outside this check.' };
  mkdirSync('.flexexa/index', { recursive: true });
  writeFileSync('.flexexa/index/web-http-report.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} catch (error) {
  console.error('WEB_PRODUCTION_HTTP_FAILED', {code:error?.code??'VERIFY_FAILED',detail:String(error?.message??'').split('\n')[0].slice(0,200)});
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit').catch(() => {}), delay(5000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
