import test from 'node:test';
import assert from 'node:assert/strict';
import {verify as independentVerify,KeyObject} from 'node:crypto';
import {signPowerSnapshot,verifyPowerSnapshot} from '../src/policy-snapshot.ts';
const id=n=>'da000000-0000-4000-8000-'+String(n).padStart(12,'0');
const original=()=>({tenant_id:id(1),scope:{type:'asset',id:id(2),environment:'sandbox'},policy_set_version_id:id(3),rules_checksum:'ab'.repeat(32),
 valid_from:'2026-09-10T12:00:00Z',valid_until:'2026-09-10T13:00:00Z',compiled_constraints:{minimum_kw:0,maximum_kw:7,deny_reasons:[],applied_rule_versions:[id(4)]}});
const pair=await crypto.subtle.generateKey('Ed25519',false,['sign','verify']);
const trust=()=>({tenant_id:id(1),scope:original().scope,policy_set_version_id:id(3),rules_checksum:'ab'.repeat(32),key_id:'policy-key-1',public_key:pair.publicKey,
 key_valid_from:'2026-09-10T00:00:00Z',key_valid_until:'2026-09-11T00:00:00Z'});
const now='2026-09-10T12:30:00Z';
const sign=p=>signPowerSnapshot(p,'policy-key-1',pair.privateKey);
test('real Ed25519 signature round trip, independent verifier and detached immutable constraints',async()=>{
 const input=original(),signed=await sign(input),result=await verifyPowerSnapshot(signed,trust(),now);
 const {signature,...payload}=signed;
 assert(independentVerify(null,Buffer.from('flexexa.power-policy-snapshot.v1\n'+JSON.stringify({key_id:signature.key_id,payload})),KeyObject.from(pair.publicKey),Buffer.from(signature.value,'base64url')));
 assert.equal(result.compiled_constraints.maximum_kw,7);input.compiled_constraints.maximum_kw=100;
 assert.equal(signed.compiled_constraints.maximum_kw,7);
 for(const fn of [()=>{result.compiled_constraints.maximum_kw=100;},()=>result.compiled_constraints.applied_rule_versions.pop(),()=>{result.scope.environment='production';},()=>{signed.signature.value='changed';}])assert.throws(fn,TypeError);
});
test('signed metadata and compiled constraints cannot be tampered with',async()=>{
 const signed=await sign(original());
 for(const mutate of [p=>{p.compiled_constraints.maximum_kw=100;},p=>{p.valid_until='2026-09-10T14:00:00Z';},p=>{p.compiled_constraints.deny_reasons=['DENIED'];},p=>{p.compiled_constraints.applied_rule_versions=[id(5)];},p=>{p.valid_from='2026-09-10T11:00:00Z';}]){
  const altered=structuredClone(signed);mutate(altered);await assert.rejects(()=>verifyPowerSnapshot(altered,trust(),now),{code:'POLICY_DENIED'});
 }
});
test('trusted tenant, scope, environment, current version and checksum all bind verification',async()=>{
 const signed=await sign(original());
 for(const patch of [{tenant_id:id(8)},{scope:{...original().scope,id:id(8)}},{scope:{...original().scope,type:'site'}},
  {scope:{...original().scope,environment:'production'}},{policy_set_version_id:id(8)},{rules_checksum:'cd'.repeat(32)}])await assert.rejects(()=>verifyPowerSnapshot(signed,{...trust(),...patch},now));
});
test('snapshot and signing-key expiry are half-open; not-yet-valid snapshots fail closed',async()=>{
 const signed=await sign(original());await verifyPowerSnapshot(signed,trust(),original().valid_from);
 for(const at of [original().valid_until,'2026-09-10T11:59:59.999Z'])await assert.rejects(()=>verifyPowerSnapshot(signed,trust(),at),{code:'POLICY_DENIED'});
 for(const patch of [{key_valid_until:now},{key_valid_from:'2026-09-10T12:30:00.001Z'}])await assert.rejects(()=>verifyPowerSnapshot(signed,{...trust(),...patch},now),{code:'POLICY_DENIED'});
});
test('unknown key, wrong key, algorithm substitution and malformed signature cannot pass',async()=>{
 const signed=await sign(original()),other=await crypto.subtle.generateKey('Ed25519',false,['sign','verify']);
 for(const patch of [{key_id:'other-key'},{public_key:other.publicKey},{public_key:pair.privateKey}])await assert.rejects(()=>verifyPowerSnapshot(signed,{...trust(),...patch},now),{code:'POLICY_DENIED'});
 for(const signature of [{...signed.signature,algorithm:'none'},{...signed.signature,value:'x'},{...signed.signature,extra:true},
  {...signed.signature,value:'A'.repeat(86)},{...signed.signature,key_id:'other-key'}])await assert.rejects(()=>verifyPowerSnapshot({...signed,signature},trust(),now));
});
test('invalid or empty compiled evidence, unknown fields and cross-tenant tenant scopes cannot be signed',async()=>{
 for(const patch of [{extra:true},{scope:{type:'tenant',id:id(8),environment:'sandbox'}},{valid_until:original().valid_from},
  {compiled_constraints:{...original().compiled_constraints,maximum_kw:Infinity}},
  {compiled_constraints:{...original().compiled_constraints,minimum_kw:8}},
  {compiled_constraints:{...original().compiled_constraints,applied_rule_versions:[]}},
  {compiled_constraints:{...original().compiled_constraints,deny_reasons:['private@example.invalid']}}])await assert.rejects(()=>sign({...original(),...patch}));
 await assert.rejects(()=>signPowerSnapshot(original(),'policy-key-1',pair.publicKey),{code:'VALIDATION_ERROR'});
});
test('valid signed deny is preserved and duplicate evidence is canonicalized',async()=>{
 const p=original();p.compiled_constraints.deny_reasons=['SAFETY_DENY','SAFETY_DENY'];p.compiled_constraints.applied_rule_versions=[id(4).toUpperCase(),id(4)];
 const verified=await verifyPowerSnapshot(await sign(p),trust(),now);
 assert.deepEqual(verified.compiled_constraints.deny_reasons,['SAFETY_DENY']);assert.deepEqual(verified.compiled_constraints.applied_rule_versions,[id(4)]);
});
