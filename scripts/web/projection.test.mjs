import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blobHash, validateManifest } from './source-parity.mjs';
import { assertPage, staticAssets, canary } from './http-contract.mjs';
const manifest = JSON.parse(readFileSync('.flexexa/web-projection.json', 'utf8'));
const html = '<html lang="sv"><title>Flexexa</title><h1>Energy flexibility infrastructure.</h1><p>Phase 0 foundation is being built from canonical contracts outward.</p><script src="/_next/static/chunks/app.js"></script><link href="/_next/static/css/app.css"></html>';
test('preserves every copied blob from the reviewed source', () => {
  for (const [path, expected] of validateManifest(manifest)) assert.equal(blobHash(readFileSync(path)), expected, path);
});
for (const key of ['sourceCommit', 'sourceTree']) test(`rejects invalid ${key}`, () => {
  assert.throws(() => validateManifest({ ...manifest, [key]: 'main' }), /WEB_SOURCE_PARITY_REJECTED/);
});
for (const path of ['../outside', '/tmp/escape', 'a/../b', 'a//b', '.env', 'a/private.key']) test(`rejects unsafe source path ${path}`, () => {
  assert.throws(() => validateManifest({ ...manifest, files: { ...manifest.files, [path]: 'a'.repeat(40) } }), /WEB_SOURCE_PARITY_REJECTED/);
});
test('rejects incomplete projection rather than allowing a new placeholder', () => {
  const broken = structuredClone(manifest); delete broken.files['apps/web/src/app/page.tsx'];
  assert.throws(() => validateManifest(broken), /WEB_SOURCE_PARITY_REJECTED/);
});
test('accepts public shell HTTP contract and deduplicated same-origin assets', () => {
  assertPage(200, 'text/html; charset=utf-8', html);
  assert.equal(staticAssets(html + '<script src="/_next/static/chunks/app.js"></script>').length, 2);
});
for (const [name, status, contentType, body] of [
  ['server failure', 500, 'text/html', html], ['wrong MIME', 200, 'application/json', html],
  ['missing heading', 200, 'text/html', html.replace('<h1>', '<div>')],
  ['wrong language', 200, 'text/html', html.replace('lang="sv"', 'lang="en"')],
  ['secret leak', 200, 'text/html', html + canary],
]) test(`HTTP gate rejects ${name}`, () => assert.throws(() => assertPage(status, contentType, body)));
test('requires real JS/CSS assets and rejects unsafe local paths', () => {
  assert.throws(() => staticAssets('<script src="https://example.com/app.js"></script>'));
  assert.throws(() => staticAssets(html.replace('chunks/app.js', '../app.js')));
});
test('Vercel preserves pinned frozen installation and only builds the web workspace', () => {
  const config = JSON.parse(readFileSync('apps/web/vercel.json', 'utf8'));
  assert.equal(config.installCommand, 'cd ../.. && corepack pnpm@12.3.4 install --frozen-lockfile');
  assert.equal(config.buildCommand, 'cd ../.. && corepack pnpm@12.3.4 --filter @flexexa/web build');
  assert.equal(config.framework, 'nextjs');
});
