import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { collectChanges, classifyRisk, analyze } from '../impact-analysis.mjs';
const config = {risk:{highPrefixes:['supabase/','packages/domain/','infra/'],highFiles:['pnpm-lock.yaml'],highTerms:['rbac','rules','ledger']}};
function fixture(t) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'flexexa-impact-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'}).toString().trim();
 git('init','-q'); git('config','user.email','fixture@example.invalid');git('config','user.name','Fixture');
 fs.writeFileSync(path.join(root,'README.md'),'baseline');git('add','.');git('commit','-qm','baseline');
 return {root,git};
}
test('invalid base is an error, not an empty diff',t=>{const {root}=fixture(t);assert.throws(()=>collectChanges(root,'no-such-ref'));});
test('unchanged exact base is empty',t=>{const {root}=fixture(t);assert.deepEqual(collectChanges(root,'HEAD').files,[]);});
test('uncommitted changes included',t=>{const {root}=fixture(t);fs.writeFileSync(path.join(root,'README.md'),'changed');assert.deepEqual(collectChanges(root,'HEAD').files,['README.md']);});
test('untracked changes included',t=>{const {root}=fixture(t);fs.writeFileSync(path.join(root,'new file.ts'),'');assert.ok(collectChanges(root,'HEAD').files.includes('new file.ts'));});
test('staged deletions included',t=>{const {root,git}=fixture(t);git('rm','README.md');assert.ok(collectChanges(root,'HEAD').files.includes('README.md'));});
test('committed changes included',t=>{const {root,git}=fixture(t);const base=git('rev-parse','HEAD');fs.writeFileSync(path.join(root,'README.md'),'changed');git('commit','-qam','changed');assert.deepEqual(collectChanges(root,base).files,['README.md']);});
test('ignored credentials are not change inputs',t=>{const {root}=fixture(t);fs.writeFileSync(path.join(root,'.gitignore'),'.env\n');fs.writeFileSync(path.join(root,'.env'),'LOCAL_FIXTURE=not-a-secret');assert.ok(!collectChanges(root,'HEAD').files.includes('.env'));});
test('pending SQL and RBAC changes high risk',()=>{assert.equal(classifyRisk('supabase/proposals/change.sql',config),'HIGH');assert.equal(classifyRisk('services/rbac/helper.ts',config),'HIGH');});
test('lockfile high risk',()=>assert.equal(classifyRisk('pnpm-lock.yaml',config),'HIGH'));
test('package reverse dependency expansion',t=>{
 const {root}=fixture(t);const dir=path.join(root,'.flexexa/index');fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(root,'.flexexa/impact-config.json'),JSON.stringify(config));
 for(const p of ['packages/domain/src/x.ts','apps/web/src/view.ts']){fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),'');}
 const data={'package-graph.json':[{name:'domain',path:'packages/domain',localDependencies:[]},{name:'web',path:'apps/web',localDependencies:['domain']}],'import-graph.json':[],'test-map.json':[]};
 for(const [name,value] of Object.entries(data))fs.writeFileSync(path.join(dir,name),JSON.stringify(value));
 const result=analyze(root,'HEAD');assert.equal(result.risk,'HIGH');assert.ok(result.affectedPackages.includes('web'));assert.ok(result.impactedFiles.includes('apps/web/src/view.ts'));assert.equal(result.fullSuiteRequired,true);
});
