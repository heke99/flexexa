import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
assert.equal(pkg.workspaces,undefined,'Root project must not declare workspaces');
for(const path of ['pnpm-workspace.yaml','turbo.json','apps/web/package.json'])assert.equal(existsSync(path),false,`Legacy workspace remains: ${path}`);
for(const path of ['src/app/page.tsx','src/app/app/page.tsx','next.config.ts','tsconfig.json','pnpm-lock.yaml'])assert.ok(existsSync(path),`Missing project file: ${path}`);
assert.equal(pkg.scripts.build,'next build');
assert.ok(!pkg.devDependencies.turbo);
console.log('Unified project structure: passed. Historical web projection retained as provenance only.');
