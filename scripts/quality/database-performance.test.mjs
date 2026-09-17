import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('docs/quality/database-performance-indexes.json', root), 'utf8'));
const candidates = readdirSync(new URL('supabase/migrations/', root)).filter((p) => p.endsWith('_phase0_database_performance.sql'));
const sql = candidates.length === 1 ? readFileSync(new URL(`supabase/migrations/${candidates[0]}`, root), 'utf8') : '';
const executable = sql.replace(/^--.*$/gm, '');
const dbTest = readFileSync(new URL('supabase/tests/database/017_database_performance.test.sql', root), 'utf8');

test('there is exactly one forward migration for this boundary', () => {
  assert.equal(candidates.length, 1);
  assert.match(candidates[0], /^\d{14}_phase0_database_performance\.sql$/);
});
test('reviewed index manifest has unique exact definitions', () => {
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.indexes.length, 19);
  assert.equal(new Set(manifest.indexes.map((i) => i.name)).size, 19);
  assert.equal(new Set(manifest.indexes.map((i) => `${i.table}:${i.columns.join(',')}`)).size, 19);
  for (const i of manifest.indexes) {
    for (const id of [i.name, i.table, ...i.columns]) assert.match(id, /^[a-z][a-z0-9_]*$/);
    assert.ok(sql.includes(`create index ${i.name} on public.${i.table}(${i.columns.join(', ')});`));
    assert.ok(dbTest.includes(`'${i.name}'`));
  }
  assert.equal((executable.match(/create index /g) ?? []).length, 19);
});
test('only proven non-unique prefix indexes are replaced', () => {
  const removed = [...executable.matchAll(/drop index public\.([a-z_]+);/g)].map((m) => m[1]);
  assert.deepEqual(removed, manifest.replaced_prefix_indexes);
  assert.deepEqual(removed, ['assets_tenant_site_idx', 'inbox_organization_idx', 'outbox_organization_idx']);
  assert.ok(executable.lastIndexOf('create index ') < executable.indexOf('drop index '));
});
test('migration cannot alter data, constraints, grants, functions or tenant ownership', () => {
  assert.doesNotMatch(executable, /\b(insert|update|delete|truncate|grant|revoke)\b/i);
  assert.doesNotMatch(executable, /\b(drop|alter|create)\s+(table|function|trigger|constraint|schema|role)\b/i);
  assert.doesNotMatch(executable, /\b(security definer|disable row level security|if not exists)\b/i);
});
test('only the existing user identifier expressions become statement-cached', () => {
  assert.equal((executable.match(/alter policy /g) ?? []).length, 2);
  assert.equal((executable.match(/\(select auth\.uid\(\)\)/g) ?? []).length, 2);
  assert.match(executable, /using \(user_id = \(select auth\.uid\(\)\)\s+or private\.flexexa_has_permission\(tenant_id, 'membership.read'\)\s+or private\.flexexa_is_platform_admin\(\)\)/);
  assert.match(executable, /using \(user_id = \(select auth\.uid\(\)\) or private\.flexexa_is_platform_admin\(\)\)/);
  assert.doesNotMatch(executable, /select private\./i);
});
test('index changes have bounded waits and no concurrent-build transaction mismatch', () => {
  assert.match(executable, /set local lock_timeout = '5s';/);
  assert.match(executable, /set local statement_timeout = '60s';/);
  assert.doesNotMatch(executable, /\bconcurrently\b/i);
});
test('real PostgreSQL coverage gate rejects false positives rather than allowlisting warnings', () => {
  for (const marker of ['i.indisvalid', 'i.indisready', 'i.indislive', 'i.indexprs is null', 'i.indnkeyatts', 'i.indisunique']) assert.ok(dbTest.includes(marker));
  for (const marker of ['fk_wrong_prefix', 'fk_include_only', 'fk_wrong_predicate', 'fk_wrong_unique', 'fk_reordered', 'fk_nullable', 'fk_bounded', 'fk_expression']) assert.ok(dbTest.includes(marker));
  assert.ok(dbTest.includes("n.nspname in ('public','private')"));
  assert.ok(dbTest.includes('other tenant membership denied'));
  assert.ok(dbTest.includes('new statement does not reuse the previous caller uid'));
  assert.ok(dbTest.trimEnd().endsWith('rollback;'));
});
