import test from 'node:test';
import assert from 'node:assert/strict';
import {intersectPowerPolicy} from '../src/index.ts';
const tenant='ac000000-0000-4000-8000-000000000001',version='bc000000-0000-4000-8000-000000000001';
const policy=()=>({tenant_id:tenant,policy_set_version_id:version,valid_from:'2026-09-10T00:00:00Z',valid_until:'2026-09-11T00:00:00Z',
 limits:[{rule_version_id:version,minimum_kw:0,maximum_kw:7}],deny_reasons:[]});
const evaluate=p=>intersectPowerPolicy(p,tenant,'2026-09-10T12:00:00Z');
test('a consumer cannot widen a decided limit or alter its evidence',()=>{
 const input=policy(),decision=evaluate(input);
 assert.throws(()=>{decision.constraints_json.maximum_kw=100;},TypeError);
 assert.throws(()=>decision.reason_codes.push('CHANGED'),TypeError);
 assert.throws(()=>decision.applied_rule_versions.pop(),TypeError);
 input.limits[0].maximum_kw=100;input.deny_reasons.push('CHANGED');
 assert.equal(decision.constraints_json.maximum_kw,7);assert.deepEqual(decision.reason_codes,[]);assert.deepEqual(decision.applied_rule_versions,[version]);
});
test('runtime inputs reject unknown keys, malformed lists, numeric strings and unbounded work',()=>{
 for(const patch of [{bypass:true},{limits:null},{deny_reasons:null},{deny_reasons:['']},{deny_reasons:[{}]},
  {deny_reasons:['private@example.invalid']},{deny_reasons:Array(1)},{limits:Array(1025).fill(policy().limits[0])},{deny_reasons:Array(129).fill('DENIED')},
  {limits:[{...policy().limits[0],maximum_kw:'7'}]},{limits:[{...policy().limits[0],override:true}]}]){
  assert.throws(()=>evaluate({...policy(),...patch}),{code:'VALIDATION_ERROR'});
 }
 for(const input of [null,[],{},'policy'])assert.throws(()=>evaluate(input),{code:'VALIDATION_ERROR'});
});
test('canonical version IDs and duplicate reasons produce identical stable evidence',()=>{
 const input=policy();input.policy_set_version_id=version.toUpperCase();input.limits[0].rule_version_id=version.toUpperCase();
 input.deny_reasons=['Z_DENY','A_DENY','Z_DENY'];const decision=evaluate(input);
 assert.equal(decision.policy_set_version_id,version);assert.deepEqual(decision.applied_rule_versions,[version]);assert.deepEqual(decision.reason_codes,['A_DENY','Z_DENY']);
 assert.equal(decision.allowed,false);assert.equal(decision.constraints_json,null);
});
test('policy interval is half-open and never grants outside its bounds',()=>{
 const p=policy();assert.equal(intersectPowerPolicy(p,tenant,p.valid_from).allowed,true);
 for(const at of [p.valid_until,'2026-09-09T23:59:59.999Z'])assert.equal(intersectPowerPolicy(p,tenant,at).allowed,false);
 assert.equal(evaluate({...p,valid_until:p.valid_from}).allowed,false);
});
