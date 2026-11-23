import assert from 'node:assert/strict';
import { readFile, statfs } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { projectEnduranceStorage } from './capacity-endurance.mjs';

const { values } = parseArgs({ options: { sample: { type: 'string' }, 'scratch-dir': { type: 'string' } } });
assert.ok(values.sample && values['scratch-dir'], 'Supply --sample <endurance JSONL> and --scratch-dir <path>');
const [sample, disk] = await Promise.all([readFile(values.sample, 'utf8'), statfs(values['scratch-dir'])]);
const report = projectEnduranceStorage(JSON.parse(sample), disk.bsize * disk.bavail);
console.log(JSON.stringify(report));
if (!report.fitsRelationAndGuard) process.exitCode = 2;
