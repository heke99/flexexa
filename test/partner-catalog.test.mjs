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
