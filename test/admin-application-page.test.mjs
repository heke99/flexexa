import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAdminApplicationPage } from '../src/domains/applications/admin-page.ts';
import { decodeApplicationCursor } from '../src/domains/applications/cursor.ts';

const id = 'af471b5f-e100-4cfd-a799-a960e46aaf30';
const row = {
  id, first_name: 'Syntetisk', last_name: 'Sökande', email: 'applicant@example.invalid',
  annual_miles: 0, car: 'Testbil', position: null, offer_group: 'test',
  marketing_consent: false, privacy_version: 'applications-2026-11-02-v1',
  created_at: '2026-11-26T17:30:00.000001+00:00', is_test: true,
  email_state: null, provider_id: null, last_error: null, attempts: null,
};
const payload = { count: 93, base: 93, new: 0, applications: [row], next: null };

test('admin pages keep PostgreSQL nulls from legacy rows without a joined email job', () => {
  assert.deepEqual(parseAdminApplicationPage({
    ...payload, unexpected_token: 'private fixture', applications: [{ ...row, private_value: 'private fixture' }],
  }), { count: 93, base: 93, new: 0, applications: [row], nextCursor: null });
  assert.deepEqual(parseAdminApplicationPage({ ...payload, applications: [] })?.applications, []);

  const cursor = '2026-11-26T17:30:00.000001Z';
  const page = parseAdminApplicationPage({ ...payload, next: [cursor, id] });
  assert.deepEqual(decodeApplicationCursor(page.nextCursor), { created_at: cursor, id });
});

test('admin pages reject malformed successful responses as a whole', () => {
  for (const invalid of [
    null, { ...payload, count: '93' }, { ...payload, applications: null },
    { ...payload, applications: [row, null] }, { ...payload, next: ['yesterday', id] },
    { ...payload, applications: Array(101).fill(row) },
    { ...payload, applications: [{ ...row, attempts: 'none' }] },
  ]) assert.equal(parseAdminApplicationPage(invalid), null);
});
