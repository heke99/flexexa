import assert from 'node:assert/strict';
export const canary = 'FLEXEXA_SERVER_ONLY_CANARY_NOT_FOR_BROWSER_20260917';
export function assertPage(status, contentType, html) {
  assert.equal(status, 200, 'WEB_HTTP_STATUS');
  assert.match(contentType ?? '', /^text\/html\b/i, 'WEB_HTTP_CONTENT_TYPE');
  assert.match(html, /<html\b[^>]*lang="sv"/, 'WEB_HTTP_LANGUAGE');
  assert.match(html, /<title>Flexexa<\/title>/, 'WEB_HTTP_TITLE');
  assert.match(html, /<h1>Energy flexibility infrastructure\.<\/h1>/, 'WEB_HTTP_HEADING');
  assert.ok(html.includes('Phase 0 foundation is being built from canonical contracts outward.'), 'WEB_HTTP_SCOPE');
  assert.ok(!html.includes(canary), 'WEB_HTTP_SECRET_CANARY');
}
export function staticAssets(html) {
  const assets = [...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+\.(?:js|css))"/g)].map((match) => match[1]);
  const unique = [...new Set(assets)];
  assert.ok(unique.some((path) => path.endsWith('.css')), 'WEB_HTTP_CSS_MISSING');
  assert.ok(unique.some((path) => path.endsWith('.js')), 'WEB_HTTP_JS_MISSING');
  assert.ok(unique.length <= 50, 'WEB_HTTP_ASSET_LIMIT');
  for (const path of unique) assert.ok(!path.includes('..') && !path.includes('\\'), 'WEB_HTTP_ASSET_PATH');
  return unique;
}
