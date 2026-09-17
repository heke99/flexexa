import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyClickHouseHistory} from './clickhouse-history.mjs';

const previous = {'0001_initial.sql':'exact bytes'};
test('ClickHouse permits only forward additions while preserving exact historical SQL', () => {
  assert.deepEqual(verifyClickHouseHistory(previous, {...previous, '0002_add.sql':'new SQL'}), {migrations:2,historicalFilesPreserved:1});
  assert.throws(() => verifyClickHouseHistory(previous, {'0001_initial.sql':'changed bytes'}), /HISTORY_CHANGED/);
  assert.throws(() => verifyClickHouseHistory(previous, {}), /HISTORY_CHANGED/);
  assert.throws(() => verifyClickHouseHistory(previous, {...previous, '0001_duplicate.sql':'SQL'}), /MIGRATION_VERSION|BACKDATED/);
  assert.throws(() => verifyClickHouseHistory({'0003_initial.sql':'SQL'}, {'0003_initial.sql':'SQL','0002_backdated.sql':'SQL'}), /BACKDATED/);
  assert.throws(() => verifyClickHouseHistory({}, {'latest.sql':'SQL'}), /MIGRATION_NAME/);
  assert.throws(() => verifyClickHouseHistory({}, {}), /MIGRATIONS_MISSING/);
});
