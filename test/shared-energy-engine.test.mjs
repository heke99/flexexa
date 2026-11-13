import test from 'node:test';import assert from 'node:assert/strict';
import {planWithSharedEngine} from '../src/domains/energy-wizard/shared-engine.ts';
const start='2026-11-13T00:00:00.000Z';
const input=()=>({price_basis:'excluding_vat',slots:[{start,available_kw:4,price_sek_per_kwh:1}],assets:[{id:'car',name:'Privat namn skickas inte',kind:'load',mode:'smart',available_from:start,deadline:'2026-11-13T00:15:00.000Z',max_kw:4,priority:1,required_kwh:1}]});
test('shared planner sends bounded anonymous scenario without names/identity and preserves public display contract',async()=>{
 const r=await planWithSharedEngine(input(),{origin:'https://api-staging.flexexa.com/energy',fetcher:async(url,options)=>{
  assert.equal(url,'https://api-staging.flexexa.com/energy/v1/public/energy-plans');assert.equal(options.redirect,'error');const body=JSON.parse(options.body);assert.equal(body.problem.assets[0].required_wh,1000);assert.ok(!JSON.stringify(body).includes('Privat namn'));assert.ok(!options.headers.Authorization);
  return Response.json({version:'worker',execution:'not_dispatched',starts_at:start,price_basis:'excluding_vat',allocations:[{asset_id:'car',slot:0,wh:1000}],unmet_wh:{car:0}});
 }});assert.equal(r.engine,'shared_aws_planner');assert.equal(r.assets[0].planned_grid_kwh,1);assert.equal(r.execution,'not_dispatched');
});
test('enabled shared engine fails closed on outage, rate limit, forged dispatch/capacity and changed price basis',async()=>{
 for(const bad of [Response.json({}, {status:503}),Response.json({}, {status:429}),Response.json({execution:'dispatched'}),Response.json({execution:'not_dispatched',starts_at:start,price_basis:'excluding_vat',allocations:[{asset_id:'car',slot:0,wh:2000}],unmet_wh:{car:0}})])await assert.rejects(planWithSharedEngine(input(),{origin:'https://api-staging.flexexa.com/energy',fetcher:async()=>bad}),/Planeringen kunde inte/);
 let called=false;await assert.rejects(planWithSharedEngine(input(),{origin:'https://user:secret@attacker.invalid',fetcher:async()=>{called=true;}}));assert.equal(called,false);
});
