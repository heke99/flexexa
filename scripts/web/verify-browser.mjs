import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canary } from './http-contract.mjs';

export function assertSnapshot(snapshot, width) {
  assert.equal(snapshot?.title, 'Flexexa');
  assert.equal(snapshot?.language, 'sv');
  assert.equal(snapshot?.heading, 'Energy flexibility infrastructure.');
  assert.equal(snapshot?.mainCount, 1);
  assert.equal(snapshot?.errorOverlay, false);
  assert.equal(snapshot?.secretVisible, false);
  assert.equal(snapshot?.viewport, width);
  assert.ok(snapshot?.contentLength > 80);
  assert.ok(snapshot?.pageWidth <= width);
  assert.ok(snapshot?.headingFontSize >= 40);
}
export async function verifyBrowser(base) {
  const target = new URL(base);
  assert.equal(target.protocol, 'http:');
  assert.equal(target.hostname, '127.0.0.1');
  assert.ok(target.port && !target.username && !target.password && !target.search && !target.hash);
  assert.equal(target.pathname, '/');
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port;
  await new Promise((done) => socket.close(done));
  const driver = spawn(process.env.CHROMEDRIVER || join(process.env.CHROMEWEBDRIVER || '/usr/local/share/chromedriver-linux64', 'chromedriver'),
    [`--port=${port}`, '--allowed-ips=127.0.0.1'], { stdio: 'ignore' });
  let failed = false; driver.on('error', () => { failed = true; });
  const request = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000), redirect: 'error',
    });
    const result = await response.json();
    assert.ok(response.ok && !result.value?.error, 'WEB_BROWSER_PROTOCOL_FAILED');
    return result.value;
  };
  let session;
  try {
    let ready = false;
    for (let i = 0; i < 100; i += 1) {
      if (failed || driver.exitCode !== null) throw new Error('WEB_BROWSER_DRIVER_EXIT');
      try { if ((await request('/status')).ready) { ready = true; break; } } catch { /* Startup only. */ }
      await delay(100);
    }
    assert.ok(ready, 'WEB_BROWSER_DRIVER_NOT_READY');
    const created = await request('/session', { capabilities: { alwaysMatch: {
      browserName: 'chrome', 'goog:chromeOptions': { args: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'] },
      'goog:loggingPrefs': { browser: 'ALL' }, timeouts: { pageLoad: 15000, script: 5000, implicit: 0 },
    } } });
    session = created.sessionId;
    assert.match(session, /^[a-zA-Z0-9-]+$/);
    const prefix = `/session/${session}`;
    const viewports = [];
    const output = resolve('.flexexa/index'); mkdirSync(output, { recursive: true });
    for (const [name, width, height, mobile] of [['desktop', 1440, 900, false], ['mobile', 390, 844, true]]) {
      await request(`${prefix}/goog/cdp/execute`, { cmd: 'Emulation.setDeviceMetricsOverride', params: { width, height, deviceScaleFactor: 1, mobile } });
      await request(`${prefix}/url`, { url: target.href });
      await request(`${prefix}/execute/async`, { script: 'const done = arguments[arguments.length - 1]; requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 150)));', args: [] });
      const snapshot = await request(`${prefix}/execute/sync`, {
        script: `return {title: document.title, language: document.documentElement.lang,
          heading: document.querySelector('h1')?.textContent, mainCount: document.querySelectorAll('main').length,
          errorOverlay: !!document.querySelector('[data-nextjs-dialog], .vite-error-overlay, #webpack-dev-server-client-overlay'),
          secretVisible: document.documentElement.outerHTML.includes(arguments[0]), contentLength: document.body.innerText.trim().length,
          viewport: window.innerWidth, pageWidth: document.documentElement.scrollWidth,
          headingFontSize: parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)};`, args: [canary],
      });
      assertSnapshot(snapshot, width);
      const logs = await request(`${prefix}/se/log`, { type: 'browser' });
      // Asset status is separately enforced by the production HTTP test. This
      // gate checks actual JavaScript/console failures, not a missing favicon.
      const javascriptErrors = logs.filter((entry) => entry.level === 'SEVERE' && entry.source !== 'network').length;
      assert.equal(javascriptErrors, 0, 'WEB_BROWSER_JAVASCRIPT_ERROR');
      const screenshot = await request(`${prefix}/screenshot`);
      const image = Buffer.from(screenshot, 'base64');
      assert.ok(image.length > 100 && image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'WEB_BROWSER_SCREENSHOT_INVALID');
      writeFileSync(join(output, `web-${name}.png`), image);
      viewports.push({ name, width, height, javascriptErrors, horizontalOverflow: false });
    }
    const report = { gate: 'web-chromium-v1', status: 'passed', browser: created.capabilities.browserVersion, viewports,
      scope: 'Real Chromium render/CSS/error checks on the public production shell. Not Auth, tenant, backend or device acceptance.' };
    writeFileSync(join(output, 'web-browser-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  } finally {
    if (session) {
      try { await fetch(`http://127.0.0.1:${port}/session/${session}`, { method: 'DELETE', signal: AbortSignal.timeout(5000) }); } catch { /* Driver is terminated below. */ }
    }
    if (driver.exitCode === null) {
      driver.kill('SIGTERM');
      await Promise.race([once(driver, 'exit').catch(() => {}), delay(2000)]);
      if (driver.exitCode === null) driver.kill('SIGKILL');
    }
  }
}
