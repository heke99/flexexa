import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSpotDay,priceRequest} from '../src/spot-prices.ts';
const rows=(start='2026-11-04T23:00:00Z',count=96)=>Array.from({length:count},(_,i)=>({SEK_per_kWh:i===0?-.1:.8,time_start:new Date(Date.parse(start)+i*900000).toISOString().replace('.000Z','Z'),time_end:new Date(Date.parse(start)+(i+1)*900000).toISOString().replace('.000Z','Z')}));
test('full quarter-hour day preserves negative spot and excludes all added charges',()=>{const p=normalizeSpotDay(rows(),'SE3','2026-11-05',new Date());assert.equal(p.intervals.length,96);assert.equal(p.intervals[0].spot_sek_per_kwh_ex_vat,'-0.10000000');assert.equal(p.vat_included,false);assert.equal(p.tax_included,false);});
for(const [start,count,date] of [['2026-03-28T23:00:00Z',92,'2026-03-29'],['2026-10-24T22:00:00Z',100,'2026-10-25']])test(`Stockholm DST ${count} intervals`,()=>assert.equal(normalizeSpotDay(rows(start,count),'SE4',date,new Date()).intervals.length,count));
for(const [label,change] of [['gap',r=>r.splice(1,1)],['duplicate',r=>r[1]=r[0]],['nan',r=>r[0].SEK_per_kWh=NaN],['partial day',r=>r.pop()],['wrong date',r=>r[0].time_start='2026-11-03T23:00:00Z']])test(`reject ${label}`,()=>{const r=rows();change(r);assert.throws(()=>normalizeSpotDay(r,'SE3','2026-11-05',new Date()));});
for(const input of [['SE5','2026-11-05'],['SE3','2026-02-30'],['SE3','2026-99-01'],['../SE3','2026-11-05']])test(`invalid request ${input}`,()=>assert.throws(()=>priceRequest(...input),{code:'VALIDATION_ERROR'}));
