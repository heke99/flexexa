import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyze} from './impact-core.mjs';
const config=JSON.parse(readFileSync(new URL('../../.flexexa/impact-config.json',import.meta.url),'utf8'));
const index={imports:[],packages:[],coverage:{unknowns:[]}};
test('identity source and container changes require real Auth/DB/container gates even with a complete index',()=>{
 for(const file of ['apps/identity-service/src/server.ts','apps/identity-service/src/supabase.ts','apps/identity-service/Dockerfile']){
  const report=analyze({files:[file],dirty:false},index,config);
  assert.equal(report.risk,'HIGH');assert.equal(report.fullSuiteRequired,true);
  for(const check of ['database-replay-and-rls','rpc-contract-and-concurrency-tests','identity-auth-container-integration'])assert(report.requiredChecks.includes(check));
 }
});
test('transitive identity imports retain specialized verification',()=>{
 const report=analyze({files:['packages/helper/src/a.ts'],dirty:false},{...index,imports:[{from:'apps/identity-service/src/server.ts',to:'packages/helper/src/a.ts'}]},config);
 assert.equal(report.risk,'HIGH');assert(report.requiredChecks.includes('identity-auth-container-integration'));
});
