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
