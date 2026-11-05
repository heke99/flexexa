import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseChargingOverview,parsePlatformChargingOverview} from '../src/charging-overview.ts';
const id='f7000000-0000-4000-8000-000000000001';
const asset={asset_id:id,site_id:id,label:'BMW 330e • testbil',plan_status:'optimal',departure_at:'2026-11-06T07:00:00Z',energy_kwh:'1.38',electricity:'1.90',variable_total:'2.76',total:null,currency:'SEK'};
const overview={tenant_id:id,generated_at:'2026-11-05T12:00:00Z',mode:'simulation',assets:[asset]};
test('charging model is immutable and does not invent full total',()=>{const o=parseChargingOverview(overview,id);assert.equal(o.assets[0].total,null);assert(Object.isFrozen(o.assets[0]));});
test('duplicates rejected',()=>assert.throws(()=>parseChargingOverview({...overview,assets:[asset,asset]},id)));
for(const update of [{total:'2.76'},{energy_kwh:'NaN'},{energy_kwh:'-1'},{currency:'EUR'},{plan_status:'charging'},{provider_id:'secret'}])test(`reject unsafe projection ${JSON.stringify(update)}`,()=>assert.throws(()=>parseChargingOverview({...overview,assets:[{...asset,...update}]},id)));
test('platform aggregates cannot include customer detail',()=>assert.throws(()=>parsePlatformChargingOverview({generated_at:overview.generated_at,mode:'simulation',companies:[{tenant_id:id,label:'A',asset_count:1,planned_count:1,blocked_count:0,registration:'ABC123'}]})));
test('impossible platform counts rejected',()=>assert.throws(()=>parsePlatformChargingOverview({generated_at:overview.generated_at,mode:'simulation',companies:[{tenant_id:id,label:'A',asset_count:1,planned_count:2,blocked_count:0}]})));
test('Python optimizer projection satisfies the shared company and platform contracts',()=>{
 const data=JSON.parse(readFileSync(new URL('../../../apps/web/public/previews/operations/preview-data.json',import.meta.url),'utf8'));
 const company=parseChargingOverview(data.company.overview,id);
 const platform=parsePlatformChargingOverview(data.platform);
 assert.equal(company.assets.length,3);assert.equal(platform.companies.length,2);
 assert.equal(platform.companies[0].asset_count,company.assets.length);
 for(const asset of company.assets.filter(a=>a.plan_status==='optimal')){
  assert.equal(data.company.timeline.filter(r=>r.asset_id===asset.asset_id).reduce((n,r)=>n+Number(r.energy_kwh),0),Number(asset.energy_kwh));
 }
});
