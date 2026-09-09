import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {changedFiles,classify,analyze} from './impact-core.mjs';
const config={highFiles:['package.json','AGENTS.md'],highPrefixes:['packages/domain/','packages/kernel/','supabase/','infra/','scripts/quality/','.github/workflows/']};
const baseIndex={imports:[],packages:[],coverage:{mode:'syntactic-conservative',unknowns:[]}};
test('missing git base never turns into a successful empty diff',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'flexexa-impact-'));
 try{execFileSync('git',['init','-q'],{cwd:root});assert.throws(()=>changedFiles(root,'missing-base'),/BASE_REF_UNAVAILABLE/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('working-tree edits and new files are part of the impact, including spaces',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'flexexa-impact-'));
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
 try{git('init','-q');git('config','user.name','Fixture');git('config','user.email','fixture@example.invalid');fs.writeFileSync(path.join(root,'base file.ts'),'a');git('add','.');git('commit','-qm','base');fs.writeFileSync(path.join(root,'base file.ts'),'b');fs.writeFileSync(path.join(root,'new file.ts'),'c');const diff=changedFiles(root,'HEAD');assert.deepEqual(diff.files,['base file.ts','new file.ts']);assert(diff.dirty);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('canonical and infra changes are high risk; skill names do not fake a flex activation',()=>{
 assert.equal(classify('packages/domain/src/a.ts',config),'HIGH');assert.equal(classify('infra/a.tf',config),'HIGH');assert.equal(classify('docs/flexexa.md',config),'LOW');
});
test('reverse imports and transitive workspace consumers are included',()=>{
 const index={...baseIndex,imports:[{from:'packages/a/src/b.ts',to:'packages/a/src/a.ts'}],packages:[{name:'a',path:'packages/a',localDependencies:[]},{name:'b',path:'packages/b',localDependencies:['a']},{name:'web',path:'apps/web',localDependencies:['b']}]};
 const result=analyze({files:['packages/a/src/a.ts'],dirty:false},index,config);assert(result.impactedFiles.includes('packages/a/src/b.ts'));assert.deepEqual(result.impactedPackages,['a','b','web']);
});
test('dynamic/unresolved index data forces full scope',()=>{
 const result=analyze({files:['apps/web/a.ts'],dirty:false},{...baseIndex,coverage:{unknowns:['dynamic import']}},config);assert.equal(result.risk,'HIGH');assert(result.fullSuiteRequired);
});
test('database work is never verified by an import graph alone',()=>{
 const result=analyze({files:['supabase/migrations/001.sql'],dirty:false},baseIndex,config);assert(result.requiredChecks.includes('database-replay-and-rls'));
});
