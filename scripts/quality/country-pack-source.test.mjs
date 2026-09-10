import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderCountryDefaults} from '../country-packs/render-defaults.mjs';
const root=resolve(import.meta.dirname,'../..');
test('tracked forward migration is exactly compiled from immutable V1 source and legacy normalizer',()=>{
 const files=readdirSync(resolve(root,'supabase/migrations')).filter(f=>f.endsWith('_phase0_country_pack_defaults.sql'));
 assert.equal(files.length,1);assert.equal(readFileSync(resolve(root,'supabase/migrations',files[0]),'utf8'),renderCountryDefaults());
});

test('country data and compiler changes always require SQL and concurrency verification',async()=>{
 const {analyze}=await import('./impact-core.mjs');
 const config=JSON.parse(readFileSync(resolve(root,'.flexexa/impact-config.json'),'utf8'));
 for(const file of ['country-packs/se/v1.json','country-packs/registry.ts','scripts/country-packs/render-defaults.mjs']){
  const report=analyze({files:[file],dirty:false},{imports:[],packages:[],coverage:{unknowns:[]}},config);
  assert.equal(report.risk,'HIGH');assert.equal(report.fullSuiteRequired,true);
  assert(report.requiredChecks.includes('database-replay-and-rls'));assert(report.requiredChecks.includes('rpc-contract-and-concurrency-tests'));
 }
});
