import { readFileSync, lstatSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const reject = () => { throw new Error('WEB_SOURCE_PARITY_REJECTED'); };
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
export function blobHash(bytes) {
  return createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}
export function validateManifest(manifest) {
  if (!manifest || !sha(manifest.sourceCommit) || !sha(manifest.sourceTree)
    || !manifest.files || Array.isArray(manifest.files)) reject();
  const entries = Object.entries(manifest.files);
  if (entries.length < 8 || entries.length > 128) reject();
  for (const [path, hash] of entries) {
    if (!sha(hash) || !/^[a-zA-Z0-9_./-]+$/.test(path) || path.startsWith('/')
      || path.split('/').some((part) => !part || part === '..' || part === '.')
      || /(?:^|\/)\.env(?:\.|$)|\.(?:pem|key|tfstate)$/.test(path)) reject();
  }
  for (const path of ['apps/web/package.json', 'apps/web/src/app/page.tsx', 'pnpm-lock.yaml']) {
    if (!Object.hasOwn(manifest.files, path)) reject();
  }
  return entries;
}
export function verifySourceParity(root = process.cwd()) {
  const manifest = JSON.parse(readFileSync(resolve(root, '.flexexa/web-projection.json'), 'utf8'));
  const entries = validateManifest(manifest);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (git('rev-parse', `${manifest.sourceCommit}^{tree}`).trim() !== manifest.sourceTree) reject();
  for (const [path, expected] of entries) {
    const full = resolve(root, path);
    if (!lstatSync(full).isFile() || blobHash(readFileSync(full)) !== expected
      || git('rev-parse', `${manifest.sourceCommit}:${path}`).trim() !== expected) reject();
  }
  const expectedWebFiles = [...entries.map(([path]) => path).filter((path) => path.startsWith('apps/web/')), 'apps/web/vercel.json'].sort();
  const trackedWebFiles = git('ls-files', '-z', '--', 'apps/web').split('\0').filter(Boolean).sort();
  if (!isDeepStrictEqual(trackedWebFiles, expectedWebFiles)) reject();
  const source = JSON.parse(git('show', `${manifest.sourceCommit}:package.json`));
  const current = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  for (const field of ['name', 'private', 'packageManager', 'engines', 'dependencies', 'devDependencies']) {
    if (!isDeepStrictEqual(source[field], current[field])) reject();
  }
  return { gate: 'web-source-parity-v1', status: 'passed', sourceCommit: manifest.sourceCommit,
    copiedFiles: entries.length, scope: 'Web shell/source tooling only. Root commands reflect the limited main workspace, not full foundation acceptance.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 2) reject();
    console.log(JSON.stringify(verifySourceParity()));
  } catch {
    console.error('WEB_SOURCE_PARITY_REJECTED');
    process.exitCode = 1;
  }
}
