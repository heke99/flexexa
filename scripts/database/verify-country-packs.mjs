import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {ensureSourceWorkspace} from './source-workspace.mjs';
for(const [key,value] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'})){
 if(process.env[key]!==value)throw Error('Refusing non-disposable country-pack verification');
}
ensureSourceWorkspace();
const {getCountryPack,legacyCoreV1Defaults}=await import('../../country-packs/registry.ts');
const {parseCreateSitePayload}=await import('../../packages/api-contracts/src/index.ts');
const literal=value=>"'"+value.replaceAll("'","''")+"'";
function sql(query){return JSON.parse(execFileSync('psql',['-XAtq','--set=ON_ERROR_STOP=1','--command',query],{encoding:'utf8',timeout:30000}));}
assert.deepEqual(sql('select private.flexexa_core_v1_country_defaults();'),legacyCoreV1Defaults);
const se=getCountryPack('SE');
assert.deepEqual(sql("select jsonb_agg(jsonb_build_object('code',code,'timezone',timezone,'currency',currency) order by code) from public.market_areas where country_code='SE';"),
 se.price_areas.map(code=>({code,timezone:se.timezone,currency:se.currency})));
let cases=0;
for(const location of [{},{country_code:'SE'},{country_code:'NO'},{country_code:'NO',timezone:'Europe/Oslo'},{country_code:'SE',timezone:'UTC'}]){
 const input={customer_id:'a0000000-0000-4000-8000-000000000001',name:' Legacy location ',...location};
 assert.deepEqual(sql(`select private.flexexa_normalize_core_input('site',${literal(JSON.stringify(input))}::jsonb);`),parseCreateSitePayload(input));cases++;
}
console.log(JSON.stringify({country_pack_metadata_sql_parity:true,swedish_price_areas:se.price_areas.length,legacy_location_contract_cases:cases}));
