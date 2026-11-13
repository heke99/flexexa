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
