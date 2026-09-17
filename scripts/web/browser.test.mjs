import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSnapshot, verifyBrowser } from './verify-browser.mjs';
const valid = { title: 'Flexexa', language: 'sv', heading: 'Energy flexibility infrastructure.', mainCount: 1,
  errorOverlay: false, secretVisible: false, viewport: 390, pageWidth: 390, contentLength: 120, headingFontSize: 40 };
test('accepts the rendered mobile shell with loaded CSS', () => assertSnapshot(valid, 390));
for (const [field, value] of [['title', ''], ['language', 'en'], ['heading', ''], ['mainCount', 0], ['errorOverlay', true],
  ['secretVisible', true], ['viewport', 500], ['pageWidth', 500], ['contentLength', 0], ['headingFontSize', 16]]) {
  test(`rejects browser defect ${field}`, () => assert.throws(() => assertSnapshot({ ...valid, [field]: value }, 390)));
}
for (const url of ['https://127.0.0.1:3000/', 'http://example.com:3000/', 'http://user:secret@127.0.0.1:3000/', 'http://127.0.0.1:3000/other']) {
  test(`rejects noncanonical browser target ${url.replace('user:secret@', '')}`, async () => assert.rejects(verifyBrowser(url)));
}
