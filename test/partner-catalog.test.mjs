import test from 'node:test';import assert from 'node:assert/strict';
import {partnerCatalog,partnerCode} from '../src/domains/partner-offers/catalog.ts';
test('partner advertising describes conditional price and closed purchase without sharing customer data',()=>{
 const c=partnerCatalog('gridex');assert.ok(c);assert.equal(c.customer_data_shared,false);assert.equal(c.integration_status,'public_handoff_only');
 assert.deepEqual(c.offers.map(o=>o.amount_minor),[166000,157000]);assert.ok(c.offers.every(o=>o.purchase_available===false&&o.vat_included===true));
 assert.match(c.offers[1].price_condition,/bekräftad rabattgrundande elleverans/);assert.match(c.offers[1].price_condition,/faktureras separat/);
 for(const offer of c.offers){const u=new URL(offer.url);assert.equal(u.origin,'https://ladda.flexexa.com');assert.deepEqual([...u.searchParams.keys()],['partner']);assert.equal(u.searchParams.get('partner'),'gridex');}
});
test('unknown or injected partners cannot mint redirect URLs or claim eligibility',()=>{
 for(const value of ['unknown','https://evil.test','../gridex','Gridex','gridex?discount=100',null]){assert.equal(partnerCode(value),null);assert.equal(partnerCatalog(value),null);}
});

// Exercise the actual public contract, including JSON parsing and local refs.
// This catches malformed documentation and fields added to the live catalogue
// without a consumable schema for partner apps.
import {readFile} from 'node:fs/promises';
test('published OpenAPI parses and describes the current catalogue and immutable v5 terms',async()=>{
 const doc=JSON.parse(await readFile(new URL('../public/openapi/partner-offers-v1.json',import.meta.url),'utf8'));
 assert.equal(doc.openapi,'3.1.0');assert.equal(doc.servers[0].url,'https://www.flexexa.com');assert.deepEqual(doc.security,[]);
 const response=doc.paths['/api/v1/partners/{partner}/offers'].get.responses['200'];
 const ref=response.content['application/json'].schema.$ref;
 assert.equal(ref,'#/components/schemas/PartnerCatalogue');
 const schema=doc.components.schemas.PartnerCatalogue,catalog=partnerCatalog('gridex');
 const assertShape=(value,contract)=>{
  for(const key of contract.required)assert.ok(Object.hasOwn(value,key),'missing required '+key);
  for(const [key,valueType] of Object.entries(value)){
   const field=contract.properties[key];assert.ok(field,'undocumented '+key);
   if(field.type==='array')assert.ok(Array.isArray(valueType));
   else if(field.type==='integer')assert.ok(Number.isInteger(valueType));
   else assert.equal(typeof valueType,field.type);
   if(Object.hasOwn(field,'const'))assert.equal(valueType,field.const);
   if(field.enum)assert.ok(field.enum.includes(valueType));
   if(field.format==='uri')assert.equal(new URL(valueType).protocol,'https:');
  }
 };
 assertShape(catalog,schema);
 assert.equal(schema.properties.offers.items.$ref,'#/components/schemas/Offer');
 for(const offer of catalog.offers){
  assertShape(offer,doc.components.schemas.Offer);
  assert.equal(offer.renewal_binding_months,2);assert.equal(offer.renewal_months,2);
  assert.equal(new URL(offer.terms_url).pathname,'/terms/'+offer.terms_version+'.pdf');
 }
});

import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {partnerLinks} from '../src/domains/partner-offers/catalog.ts';
import {approvedPublication,readPublicOffers,validatePublicOfferRelease} from '../src/domains/partner-offers/publication.ts';
import release from '../src/domains/partner-offers/releases/flexexa-partner-offers-2026-11-13-v2.json' with {type:'json'};

test('public offers require an approved, current Commerce release and retain approved purchase closure',()=>{
 const before=new Date('2026-11-12T22:59:59Z'),effective=new Date('2026-11-12T23:00:00Z');
 assert.equal(readPublicOffers(before),null);
 assert.equal(partnerCatalog('gridex',before),null);
 assert.equal(readPublicOffers(effective).initialMinimumMinor,332000);
 assert.equal(readPublicOffers(effective).gridexAmountMinor,157000);
 assert.equal(readPublicOffers(effective).purchaseAvailable,false);
 assert.equal(validatePublicOfferRelease({...release,standardAmountMinor:166001},approvedPublication,effective),null);
 const matchingPointer=value=>({version:value.version,sha256:createHash('sha256').update(JSON.stringify(value)).digest('hex')});
 for(const changes of [
  {standardAmountMinor:-1},{gridexDiscountMinor:166000},{gridexDiscountMinor:0},{vatIncluded:false},{currency:'EUR'},
  {purchaseAvailable:true},{termsVersion:'../../other'},{effectiveFrom:'2026-02-31'},{availabilityReason:''},
  {gridexDiscountCondition:'always'},{initialBindingMonths:0},{commerceRevision:'latest'},{interval:'year'},
 ]){
  const value={...release,...changes};
  assert.equal(validatePublicOfferRelease(value,matchingPointer(value),effective),null,JSON.stringify(changes));
 }
 assert.equal(validatePublicOfferRelease(release,{...approvedPublication,version:'different-release'},effective),null);
 assert.equal(validatePublicOfferRelease(release,approvedPublication,new Date(NaN)),null);
});

test('validated partner links retain their origin, path and only the known query value',()=>{
 assert.deepEqual(partnerLinks('gridex'),{
  landing:'https://flexexa.com/partner/gridex',
  energyWizard:'https://flexexa.com/energy-wizard?partner=gridex',
  orders:'https://ladda.flexexa.com/bestallningar?partner=gridex',
  standalone:'https://ladda.flexexa.com/elbilsabonnemang/flexexa/orderoversikt?partner=gridex',
  gridex:'https://ladda.flexexa.com/elbilsabonnemang/flexexa-gridex?partner=gridex',
 });
 for(const invalid of ['gridex%26source=other','gridex#stripe','GRIDEX','https://evil.test','gridex/../other']){
  assert.equal(partnerLinks(invalid),null);
 }
});

test('approved publication agrees with pinned Commerce terms and policy', {skip:!process.env.COMMERCE_OFFER_SOURCE_DIR},()=>{
 const source=process.env.COMMERCE_OFFER_SOURCE_DIR;
 const read=path=>execFileSync('git',['-C',source,'show',release.commerceRevision+':'+path],{encoding:'utf8'});
 const terms=read('docs/web/private-terms-2026-11-13-v5-sv.md');
 const policy=JSON.parse(read('docs/web/private-contract-policy-v5.json'));
 assert.equal(release.termsVersion,policy.version);
 assert.equal(release.initialBindingMonths,policy.initial_binding_months);
 assert.equal(release.renewalBindingMonths,policy.renewal_months);
 assert.equal(release.noticeMonths,policy.notice_months);
 assert.equal(release.purchaseAvailable,policy.purchase_enabled);
 assert.equal(release.calendarTimezone,policy.energy_surcharge.time_zone);
 const prices=/Ordinarie månadspris är ([\d ]+) kr inklusive moms\. Rabatt .* är ([\d ]+) kr per månad, vilket ger ([\d ]+) kr inklusive moms\./.exec(terms);
 assert.ok(prices);
 const amounts=prices.slice(1).map(value=>Number(value.replaceAll(' ',''))*100);
 assert.deepEqual(amounts,[release.standardAmountMinor,release.gridexDiscountMinor,release.standardAmountMinor-release.gridexDiscountMinor]);
 assert.match(terms,/Rabatten gäller endast medan sådan elleverans är aktiv/);
});
