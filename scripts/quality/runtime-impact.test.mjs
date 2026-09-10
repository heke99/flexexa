import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {analyze} from './impact-core.mjs';
const config=JSON.parse(readFileSync(resolve(import.meta.dirname,'../../.flexexa/impact-config.json'),'utf8'));
const index={imports:[],packages:[],coverage:{unknowns:[]}};
test('isolated runtime and Lua changes cannot pass from application checks alone',()=>{
 for(const file of ['infra/docker/compose.yml','infra/docker/valkey/release-lease.lua','scripts/runtime/verify-valkey.mjs']){
  const report=analyze({files:[file],dirty:false},index,config);
  assert.equal(report.risk,'HIGH');assert(report.requiredChecks.includes('runtime-protocol-and-container-security-tests'));
  assert(!report.requiredChecks.includes('infra-plan-and-iam-review'));
 }
 const report=analyze({files:['infra/opentofu/modules/foundation/main.tf'],dirty:false},index,config);
 assert(report.requiredChecks.includes('infra-plan-and-iam-review'));
});
