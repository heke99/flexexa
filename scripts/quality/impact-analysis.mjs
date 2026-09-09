import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { changedFiles, analyze } from './impact-core.mjs';
const root=process.cwd(),dir=path.join(root,'.flexexa/index');
const i=process.argv.indexOf('--base');
const requested=i<0?(process.env.IMPACT_BASE||'origin/main'):process.argv[i+1];
// Validate the base FIRST. Never manufacture success when git history is missing.
const diff=changedFiles(root,requested);
execFileSync(process.execPath,[path.join(root,'scripts/quality/build-codebase-index.mjs')],{cwd:root,stdio:'inherit'});
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'));
const config=JSON.parse(fs.readFileSync(path.join(root,'.flexexa/impact-config.json'),'utf8'));
const report=analyze(diff,{imports:read('import-graph.json'),packages:read('package-graph.json'),coverage:read('manifest.json').coverage},config);
fs.writeFileSync(path.join(dir,'impact-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(`Impact ${report.risk}: ${report.changedFiles.length} changed files; ${report.impactedPackages.length} affected packages.`);
console.log(`Required checks: ${report.requiredChecks.join(', ')}`);
