import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const split = value => value.split('\0').filter(Boolean);
function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function readIndex(root, name) {
  return JSON.parse(fs.readFileSync(path.join(root, '.flexexa/index', name), 'utf8'));
}
export function collectChanges(root, base) {
  const baseSha = git(root, ['rev-parse', '--verify', '--end-of-options', `${base}^{commit}`]).trim();
  const head = git(root, ['rev-parse', 'HEAD']).trim();
  const committed = split(git(root, ['diff', '--name-only', '-z', `${baseSha}...${head}`, '--']));
  const dirty = split(git(root, ['diff', '--name-only', '-z', 'HEAD', '--']));
  const untracked = split(git(root, ['ls-files', '--others', '--exclude-standard', '-z']));
  return { base: baseSha, head, dirty: dirty.length + untracked.length > 0, files: [...new Set([...committed, ...dirty, ...untracked])].sort() };
}
export function classifyRisk(file, config) {
  if (config.risk.highPrefixes.some(p => file.startsWith(p)) ||
      config.risk.highFiles.includes(file) || /\.tf$/.test(file) ||
      file.split(/[/.\-_]/).some(part => config.risk.highTerms.includes(part))) return 'HIGH';
  if (/^(apps|services|packages|scripts|docker|compose)\//.test(file)) return 'MEDIUM';
  return 'LOW';
}
export function analyze(root, base) {
  const diff = collectChanges(root, base);
  const config = JSON.parse(fs.readFileSync(path.join(root, '.flexexa/impact-config.json'), 'utf8'));
  const imports = readIndex(root, 'import-graph.json');
  const packages = readIndex(root, 'package-graph.json');
  const tests = new Set(readIndex(root, 'test-map.json'));
  const files = split(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']));
  const reverse = new Map();
  for (const edge of imports) {
    if (!edge.to) continue;
    if (!reverse.has(edge.to)) reverse.set(edge.to, new Set());
    reverse.get(edge.to).add(edge.from);
  }
  const changedPackages = new Set();
  for (const file of diff.files) {
    const owner = packages.filter(p => p.path && file.startsWith(p.path + '/')).sort((a,b) => b.path.length - a.path.length)[0];
    if (owner) changedPackages.add(owner.name);
  }
  const affectedPackages = new Set(changedPackages);
  let growing = true;
  while (growing) {
    growing = false;
    for (const pkg of packages) {
      if (!affectedPackages.has(pkg.name) && pkg.localDependencies.some(p => affectedPackages.has(p))) {
        affectedPackages.add(pkg.name); growing = true;
      }
    }
  }
  const impacted = new Set(diff.files);
  for (const pkg of packages.filter(p => affectedPackages.has(p.name) && p.path)) {
    for (const file of files) if (file.startsWith(pkg.path + '/')) impacted.add(file);
  }
  const queue = [...impacted];
  while (queue.length) {
    for (const dependant of reverse.get(queue.shift()) || []) {
      if (!impacted.has(dependant)) { impacted.add(dependant); queue.push(dependant); }
    }
  }
  const ranks = { LOW: 1, MEDIUM: 2, HIGH: 3 };
  let risk = 'LOW';
  const reasons = [];
  for (const file of impacted) {
    const candidate = classifyRisk(file, config);
    if (ranks[candidate] > ranks[risk]) risk = candidate;
    if (candidate === 'HIGH') reasons.push('high-risk changed or dependent path: ' + file);
  }
  // Heuristic indexing is evidence, not a proof of complete semantic coverage.
  const sourceChanged = diff.files.some(f => /\.(?:[cm]?[jt]sx?|sql|tf)$/.test(f));
  const fullSuiteRequired = risk === 'HIGH' || diff.dirty || sourceChanged;
  if (diff.dirty) reasons.push('working tree changes require full verification');
  if (sourceChanged && risk !== 'HIGH') reasons.push('conservative fallback: semantic graph is not complete');
  const required = new Set(fullSuiteRequired ? ['full-typecheck','full-test','full-build'] : ['turbo-affected']);
  if (diff.files.some(f => f.startsWith('supabase/'))) for (const x of ['migration-replay','rls-two-tenant']) required.add(x);
  if (diff.files.some(f => /^packages\/(events|api-contracts|domain)\//.test(f))) required.add('contract-compatibility');
  if (diff.files.some(f => f.startsWith('infra/') || f.endsWith('.tf'))) for (const x of ['iam-security-review','tofu-plan']) required.add(x);
  if (diff.files.some(f => /settlement|ledger/.test(f))) for (const x of ['idempotency','ledger-balance']) required.add(x);
  if (diff.files.some(f => /reservation|services\/flex/.test(f))) required.add('concurrency-no-oversubscription');
  if (diff.files.some(f => /\.tsx$|apps\/web\//.test(f))) required.add('browser-e2e');
  return { schemaVersion: 2, ...diff, changedFiles: diff.files, risk, fullSuiteRequired,
    graphCoverage: 'heuristic-with-conservative-fallback', impactedFiles: [...impacted].sort(),
    affectedPackages: [...affectedPackages].sort(), impactedTests: [...impacted].filter(f => tests.has(f)).sort(),
    requiredChecks: [...required], reasons: [...new Set(reasons)] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = process.cwd();
    execFileSync(process.execPath, [path.join(root, 'scripts/quality/build-codebase-index.mjs')], { cwd: root, stdio: 'inherit' });
    const i = process.argv.indexOf('--base');
    const base = i >= 0 ? process.argv[i+1] : process.env.IMPACT_BASE || 'origin/main';
    if (!base) throw new Error('--base requires a value');
    const report = analyze(root, base);
    fs.writeFileSync(path.join(root, '.flexexa/index/impact-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`Flexexa impact: ${report.risk}; ${report.changedFiles.length} changed; full suite=${report.fullSuiteRequired}`);
    console.log('Required checks: ' + report.requiredChecks.join(', '));
  } catch (error) { console.error('IMPACT_ANALYSIS_FAILED: ' + error.message); process.exitCode = 1; }
}
