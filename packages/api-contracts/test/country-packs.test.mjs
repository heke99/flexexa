import test from 'node:test';
import assert from 'node:assert/strict';
import {COUNTRY_DOMAINS,getCountryPack,requireCountryDomain,resolveCountryLocation} from '../src/country-packs.ts';
import {parseCountryPack,legacyCoreV1Defaults} from '../../../country-packs/registry.ts';
import {parseCreateSitePayload} from '../src/index.ts';
const invalid=fn=>assert.throws(fn,{code:'VALIDATION_ERROR'});
test('registered Swedish metadata is immutable and does not authorize unimplemented domains',()=>{
 const pack=getCountryPack('SE');assert.equal(pack.pack_version,'1.0.0');assert.deepEqual(pack.price_areas,['SE1','SE2','SE3','SE4']);
 assert(Object.isFrozen(pack));assert(Object.isFrozen(pack.price_areas));assert(Object.isFrozen(pack.ready_domains));
 assert.throws(()=>pack.price_areas.push('SE5'),TypeError);assert.equal(requireCountryDomain('SE','metadata'),pack);
 for(const domain of COUNTRY_DOMAINS.filter(d=>d!=='metadata'))assert.throws(()=>requireCountryDomain('SE',domain),{code:'INVALID_STATE_TRANSITION'});
 assert.equal(getCountryPack('NO'),null);assert.throws(()=>requireCountryDomain('NO','metadata'),{code:'INVALID_STATE_TRANSITION'});
 invalid(()=>requireCountryDomain('SE','invented'));
});
test('new location resolver requires explicit geography and fails closed for unknown defaults',()=>{
 assert.deepEqual(resolveCountryLocation('SE'),{country_code:'SE',timezone:'Europe/Stockholm'});
 assert.deepEqual(resolveCountryLocation('NO','Europe/Oslo'),{country_code:'NO',timezone:'Europe/Oslo'});
 assert.equal(resolveCountryLocation('SE',' Europe/Stockholm ').timezone,'Europe/Stockholm');
 invalid(()=>resolveCountryLocation('NO'));invalid(()=>resolveCountryLocation('SE','invalid/zone'));
 for(const country of [undefined,null,5,{},['SE'],new String('SE'),'se','SWE',' SE'])invalid(()=>getCountryPack(country));
 for(const timezone of [null,0,{},''])invalid(()=>resolveCountryLocation('SE',timezone));
});
test('pack parser rejects malformed metadata and unknown fields without mutating source',()=>{
 const source=structuredClone(getCountryPack('SE'));
 for(const patch of [{schema_version:2},{pack_version:'1.x.0'},{pack_version:'1'.repeat(33)+'.0.0'},{currency:'sek'},
  {locale:'sv'},{country_code:'se'},{timezone:'invalid/zone'},{price_areas:[]},{price_areas:Array(1)},{ready_domains:Array(1)},{price_areas:['SE1','SE1']},
  {price_areas:['SE 1']},{ready_domains:[]},{ready_domains:['metadata','metadata']},{ready_domains:['unknown']},{tax_rate:25}]){
  invalid(()=>parseCountryPack({...source,...patch}));
 }
 const parsed=parseCountryPack(source);source.price_areas.push('SE5');assert.equal(parsed.price_areas.length,4);
});
test('V1 requests preserve historical defaults including explicit foreign country with omitted timezone',()=>{
 const input={customer_id:'a0000000-0000-4000-8000-000000000001',name:' Home '};
 const expected={customer_id:input.customer_id,name:'Home',external_site_id:null,country_code:'SE',timezone:'Europe/Stockholm'};
 assert.deepEqual(parseCreateSitePayload(input),expected);
 assert.deepEqual(parseCreateSitePayload({...input,country_code:'NO'}),{...expected,country_code:'NO'});
 assert.deepEqual(parseCreateSitePayload({...input,country_code:'NO',timezone:'Europe/Oslo'}),{...expected,country_code:'NO',timezone:'Europe/Oslo'});
 assert.deepEqual(legacyCoreV1Defaults,{country_code:'SE',timezone:'Europe/Stockholm',currency:'SEK',locale:'sv-SE'});
});
