import assert from 'node:assert/strict';
import test from 'node:test';
import { isCustomerResourceId } from '../src/lib/customer-accounts.ts';
import { normalizeCustomerOrders } from '../src/lib/customer-orders.ts';
import { normalizeProductAccess, productAccessPath } from '../src/lib/customer-product-access.ts';
import { inspectCustomerPreview } from '../src/lib/customer-preview-settings.ts';

const id = 'febdb492-ed0c-4f9d-9ce9-4dbc16c1230c';
const date = '2026-11-22T12:30:00.000Z';
const validPrice = { amount_minor: 12345, currency: 'sEk' };
const order = { id, created_at: date, quantity: 1 };

test('customer resource IDs reject UUID sentinels and preserve real versions and case', () => {
  for (const value of [id, id.toUpperCase(), '01926571-0aba-7240-990a-e2b7e2ea958f']) {
    assert.equal(isCustomerResourceId(value), true);
    assert.ok(productAccessPath(value));
  }
  for (const value of ['00000000-0000-0000-0000-000000000000', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '../accounts']) {
    assert.equal(isCustomerResourceId(value), false);
    assert.equal(productAccessPath(value), null);
  }
});

test('only sealed paid or refunded single-item orders may expose amount, with legacy rows supported', () => {
  const read = (state, agreement, quantity = 1) => normalizeCustomerOrders({ items: [{ ...order, state, agreement, quantity }] });
  for (const state of ['pending', 'blocked', 'paid', 'refunded']) {
    for (const legacy of [null, undefined]) {
      assert.deepEqual(read(state, legacy), { items: [{ id, state, createdAt: date, amountMinor: null, currency: null }] });
    }
    const showPrice = state === 'paid' || state === 'refunded';
    assert.deepEqual(read(state, validPrice), { items: [{ id, state, createdAt: date,
      amountMinor: showPrice ? 12345 : null, currency: showPrice ? 'SEK' : null }] });
    assert.equal(read(state, validPrice, 2).items[0].amountMinor, null);
    for (const invalid of [false, [], {}, { ...validPrice, amount_minor: 0 }, { ...validPrice, amount_minor: '1' },
      { ...validPrice, amount_minor: -1 }, { ...validPrice, amount_minor: 1.5 },
      { ...validPrice, amount_minor: Number.MAX_SAFE_INTEGER + 1 }, { ...validPrice, currency: 'USD' }]) {
      assert.equal(read(state, invalid), null);
    }
  }
  assert.equal(normalizeCustomerOrders({ items: [{ ...order, state: 'paid' }, { ...order, id: id.toUpperCase(), state: 'blocked' }] }), null);
});

test('one invalid product row rejects the entire authoritative access response', () => {
  const grant = { product_key: 'charging_subscription', status: 'active', version: 2, expires_at: null, enabled: true };
  const secondary = { ...grant, product_key: 'external_api' };
  const now = Date.parse(date);
  for (const invalid of [{ ...secondary, status: 'revoked' }, { ...secondary, expires_at: date }, { ...secondary, version: '2' },
    { ...secondary, enabled: 'true' }, { ...secondary, product_key: 'unknown' }, grant]) {
    assert.equal(normalizeProductAccess({ items: [grant, invalid], requests: [] }, now), null);
  }
  assert.deepEqual(normalizeProductAccess({ items: [{ ...grant, privateField: true }, secondary], requests: [] }, now), {
    items: [grant, secondary], requests: [],
  });
});

test('account preview is consistently disabled, enabled or invalid without leaking configured values', () => {
  const config = { FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW: 'true', FLEXEXA_CUSTOMER_AUTH_URL: 'https://auth.example.test/',
    FLEXEXA_CUSTOMER_API_URL: 'https://api.example.test', FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY: 'sb_publishable_fixture' };
  assert.deepEqual(inspectCustomerPreview({}), { state: 'disabled' });
  assert.deepEqual(inspectCustomerPreview({ ...config, FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW: 'false' }), { state: 'disabled' });
  assert.deepEqual(inspectCustomerPreview({ ...config, FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW: 'true' }), {
    state: 'enabled', config: { authUrl: 'https://auth.example.test', apiUrl: 'https://api.example.test',
      publishableKey: 'sb_publishable_fixture', emailOtpEnabled: true },
  });
  assert.deepEqual(inspectCustomerPreview({ FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW: 'True' }), {
    state: 'invalid', issues: ['FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW'],
  });
  assert.deepEqual(inspectCustomerPreview({ FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW: 'true' }), {
    state: 'invalid', issues: ['FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW'],
  });
  const invalid = inspectCustomerPreview({ ...config, FLEXEXA_CUSTOMER_API_URL: 'https://wrong.invalid/path',
    FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY: 'not-a-client-key' });
  assert.deepEqual(invalid, { state: 'invalid', issues: ['FLEXEXA_CUSTOMER_API_URL', 'FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY'] });
});
