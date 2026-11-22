import assert from 'node:assert/strict';
import test from 'node:test';
import { customerVehicleListPath, normalizeCustomerVehicles } from '../src/lib/customer-vehicles.ts';

const account = '0ce944fc-5677-4f0a-ad93-096a43352d8a';
const vehicle = { id: 'febdb492-ed0c-4f9d-9ce9-4dbc16c1230c', country: 'SE', plate: 'ABC123', verified_at: null };
const listPath = (query = '') => customerVehicleListPath(account, new URLSearchParams(query));

test('vehicle list restricts forwarded query to a single bounded cursor', () => {
  const path = `/v1/accounts/${account}/vehicles?limit=25`;
  assert.equal(listPath(), path);
  assert.equal(listPath('after=ABC_123-'), `${path}&after=ABC_123-`);
  for (const query of ['limit=100', 'after=', 'after=a&after=b', 'after=a%26limit%3D100', 'after=a%2F', `after=${'A'.repeat(513)}`]) {
    assert.equal(listPath(query), null, query);
  }
  assert.equal(customerVehicleListPath('../other', new URLSearchParams()), null);
});

test('vehicle list normalizes only the four public fields on a valid page', () => {
  const verified = { ...vehicle, verified_at: '2026-11-22T12:30:00.000Z' };
  assert.deepEqual(normalizeCustomerVehicles({ items: [{ ...verified, verification_ref: 'private' }], nextCursor: null, account_id: account }), {
    items: [verified], nextCursor: null,
  });
  for (const invalid of [
    { items: [vehicle] }, { items: [vehicle, vehicle], nextCursor: null },
    { items: [{ ...vehicle, verified_at: 1 }], nextCursor: null },
    { items: [{ ...vehicle, country: 'se' }], nextCursor: null },
    { items: [vehicle], nextCursor: 'abc' },
  ]) assert.equal(normalizeCustomerVehicles(invalid), null);
});
