import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

export function verifyClickHouseHistory(previous, current) {
  const versions = new Set();
  const oldVersions = Object.keys(previous).map(name => Number(name.slice(0, 4)));
  const last = Math.max(0, ...oldVersions);
  for (const [name, content] of Object.entries(previous)) {
    if (current[name] !== content) throw new Error('CLICKHOUSE_HISTORY_CHANGED');
  }
  for (const name of Object.keys(current)) {
    if (!/^\d{4}_[a-z0-9_]+\.sql$/.test(name)) throw new Error('CLICKHOUSE_MIGRATION_NAME');
    const version = Number(name.slice(0, 4));
    if (version === 0 || versions.has(version)) throw new Error('CLICKHOUSE_MIGRATION_VERSION');
    versions.add(version);
    if (!(name in previous) && version <= last) throw new Error('CLICKHOUSE_MIGRATION_BACKDATED');
  }
  if (!versions.size) throw new Error('CLICKHOUSE_MIGRATIONS_MISSING');
  return {migrations: versions.size, historicalFilesPreserved: Object.keys(previous).length};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = process.argv.indexOf('--base');
  if (arg < 0 || !process.argv[arg + 1]) throw new Error('BASE_REQUIRED');
  const base = execFileSync('git', ['rev-parse', '--verify', `${process.argv[arg + 1]}^{commit}`], {encoding:'utf8'}).trim();
  const directory = 'infra/clickhouse/migrations';
  const previous = {};
  const names = execFileSync('git', ['ls-tree', '-r', '--name-only', base, '--', directory], {encoding:'utf8'}).trim();
  for (const name of names ? names.split('\n') : []) {
    previous[path.basename(name)] = execFileSync('git', ['show', `${base}:${name}`]).toString('base64');
  }
  const current = Object.fromEntries(fs.readdirSync(directory).map(name => {
    const file = path.join(directory, name);
    if (!fs.lstatSync(file).isFile()) throw new Error('CLICKHOUSE_MIGRATION_NOT_FILE');
    return [name, fs.readFileSync(file).toString('base64')];
  }));
  console.log(JSON.stringify(verifyClickHouseHistory(previous, current)));
}
