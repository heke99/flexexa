import test from 'node:test';
import assert from 'node:assert/strict';
import {previewPlan} from '../src/lib/charging-preview.ts';
test('illustrative plan meets reachable demand with loss accounted once',()=>{const p=previewPlan(30,80,60,7);assert.equal(p.requested,30);assert.equal(p.unmet,0);assert.ok(Math.abs(p.gridEnergy-30/0.9)<1e-8);assert.ok(p.allocations['02']>0);assert.equal(p.allocations['18'],undefined);});
test('infeasible deadline exposes unmet demand and does not invent energy',()=>{const p=previewPlan(0,100,100,1);assert.ok(p.unmet>0);assert.ok(p.gridEnergy<=7*11+1e-8);});
test('already reached target never schedules discharge or charging',()=>{const p=previewPlan(90,80,60,7);assert.equal(p.requested,0);assert.equal(p.gridEnergy,0);assert.equal(p.hours,0);assert.deepEqual(p.allocations,{});});
test('invalid capacity and departure are rejected',()=>{for(const args of [[0,80,0,7],[0,80,60,0],[0,80,60,8],[NaN,80,60,7],[0,101,60,7]])assert.throws(()=>previewPlan(...args));});
