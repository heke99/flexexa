import test from 'node:test';import assert from 'node:assert/strict';
import {emptyProfile,assessProfile,validateProfile,assessmentVersion} from '../src/domains/energy-wizard/assessment.ts';
import {readAssessmentRequest} from '../src/domains/energy-wizard/request.ts';
test('unknown consumption stays unknown; no savings, purchase or control is manufactured',()=>{
 const result=assessProfile({...emptyProfile});assert.equal(result.version,assessmentVersion);assert.equal(result.profile.annualKwh,null);
 assert.ok(result.missing.includes('Din årsförbrukning från elhandelsfakturan'));assert.equal(result.recommendations[0].id,'overview');
 assert.equal('savings' in result,false);assert.equal('commands' in result,false);assert.match(result.availability,/Inget avtal tecknas/);
});
test('EV, heat pump and existing solar lead to explained resource and peak next steps',()=>{
 const p={...emptyProfile,ev:'yes',charger:'yes',heating:'heat_pump',solar:'yes',solarKwp:10,annualKwh:18000,area:'SE3',tariff:'quarterly',fuseAmps:20,goals:['cost','peaks']};
 const r=assessProfile(p);assert.deepEqual(r.recommendations.map(x=>x.id),['ev','energy','peaks','tariff']);
 assert.match(r.recommendations[0].nextStep,/Kompatibilitet behöver verifieras/);assert.match(r.recommendations[2].nextStep,/20 A/);
 assert.ok(r.recommendations.every(x=>x.reason&&x.nextStep&&x.href.startsWith('/')));assert.equal(r.profile.annualKwh,18000);
});
test('tenant permissions and missing resource sizes are visible; zero is not replaced by a default',()=>{
 const r=assessProfile({...emptyProfile,tenure:'tenant',solar:'yes',battery:'yes',annualKwh:0});
 assert.equal(r.profile.annualKwh,0);assert.ok(r.missing.some(x=>x.includes('godkänna installationer')));assert.ok(r.missing.some(x=>x.includes('batteriets')));
});
test('profile input rejects arbitrary identity, authority, coercions and inconsistent capacity',()=>{
 for(const patch of [{customerId:'other'},{partner:'gridex'},{annualKwh:''},{annualKwh:NaN},{annualKwh:Infinity},{annualKwh:-1},{fuseAmps:'16'},{solarKwp:10},{goals:[]},{goals:['cost','cost']},{home:'<script>'}])assert.throws(()=>validateProfile({...emptyProfile,...patch}));
 const p={...emptyProfile,goals:['cost']};const out=validateProfile(p);p.goals.push('peaks');assert.deepEqual(out.goals,['cost']);
});
test('assessment requests enforce origin, JSON and actual streamed byte limit',async()=>{
 const req=(body,headers={})=>new Request('https://flexexa.test/api/v1/energy-wizard/assess',{method:'POST',headers:{origin:'https://flexexa.test','content-type':'application/json',...headers},body});
 assert.deepEqual(await readAssessmentRequest(req(JSON.stringify(emptyProfile))),emptyProfile);
 const proxied=new Request('http://localhost:4185/api/v1/energy-wizard/assess',{method:'POST',headers:{host:'127.0.0.1:4185',origin:'http://127.0.0.1:4185','content-type':'application/json'},body:JSON.stringify(emptyProfile)});
 assert.deepEqual(await readAssessmentRequest(proxied),emptyProfile);
 await assert.rejects(readAssessmentRequest(req('{}',{origin:'https://other.test'})),e=>e.status===403);
 await assert.rejects(readAssessmentRequest(req('{}',{'content-type':'text/plain'})),e=>e.status===415);
 await assert.rejects(readAssessmentRequest(req('"'+'x'.repeat(8192)+'"')),e=>e.status===413);
 await assert.rejects(readAssessmentRequest(req('{broken')),e=>e.status===400);
});
