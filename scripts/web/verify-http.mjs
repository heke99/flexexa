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
const child = spawn(process.execPath, [resolve('apps/web/node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
  cwd: resolve('apps/web'), stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production', FLEXEXA_SERVER_ONLY_TEST: canary },
});
let spawnFailed = false;
child.on('error', () => { spawnFailed = true; });
const base = `http://127.0.0.1:${port}`;
const request = (path) => fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(5000) });
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
  const assets = staticAssets(html);
  for (const path of assets) {
    const asset = await request(path);
    assert.equal(asset.status, 200, 'WEB_ASSET_HTTP_STATUS');
    const body = await asset.text();
    assert.ok(body.length > 0 && !body.includes(canary), 'WEB_ASSET_CONTENT');
  }
  for (const path of ['/__flexexa_missing_page__', '/api/__flexexa_missing_endpoint__']) {
    const missing = await request(path);
    assert.equal(missing.status, 404, 'WEB_NEGATIVE_ROUTE');
    await missing.body?.cancel();
  }
  await verifyBrowser(base);
  const report = { gate: 'web-production-http-v1', status: 'passed', page: true, staticAssets: assets.length,
    negativeRoutes: 2, secretCanaryAbsent: true, scope: 'Public shell HTTP/asset verification only; no Auth, browser interaction or operational platform claim.' };
  mkdirSync('.flexexa/index', { recursive: true });
  writeFileSync('.flexexa/index/web-http-report.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} catch {
  console.error('WEB_PRODUCTION_HTTP_FAILED');
  process.exitCode = 1;
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit').catch(() => {}), delay(5000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}
