import assert from 'node:assert/strict';
import { lstatSync, mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Source-only test bootstrap. Fixed repository packages; no install or resolver hooks. */
export function ensureSourceWorkspace() {
  const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
  const modules = resolve(root, 'node_modules');
  mkdirSync(modules, { recursive: true });
  assert.equal(realpathSync(modules), modules, 'SOURCE_WORKSPACE_PARENT_MISMATCH');
  const scope = resolve(modules, '@flexexa');
  mkdirSync(scope, { recursive: true });
  assert.equal(realpathSync(scope), scope, 'SOURCE_WORKSPACE_PARENT_MISMATCH');
  for (const name of ['domain', 'api-contracts']) {
    const link = resolve(scope, name), target = realpathSync(resolve(root, 'packages', name));
    if (lstatSync(link, { throwIfNoEntry: false })) {
      assert.equal(realpathSync(link), target, 'SOURCE_WORKSPACE_LINK_MISMATCH');
    } else {
      symlinkSync(target, link, 'dir');
    }
  }
}
