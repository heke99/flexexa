import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {analyze} from './impact-core.mjs';
import {scanMasterplan,assessMasterplan} from './masterplan-core.mjs';
const root=path.resolve(import.meta.dirname,'../..'),snapshot='a'.repeat(64);
const source='# Header\n\nPreamble cannot disappear.\n'+Array.from({length:88},(_,i)=>`\n# ${i}. SECTION ${i}\n- field_${i}\n`+(i===83?Array.from({length:14},(_,p)=>`Phase ${p} — phase ${p}:\n- item_${p}\n`).join(''):'')).join('');
const scan=scanMasterplan(source);
function ledger(){return {schema_version:1,source_path:'FLEXEXA_MASTER_BUILD_PROMPT_V1.md',source_sha256:scan.source_sha256,catalog_sha256:scan.catalog_sha256,
 point_count:scan.point_count,sections:scan.sections.map(s=>({id:s.id,status:'planned',note:'Not verified.'})),phases:scan.phases.map(p=>({id:p.id,status:'planned',note:'Not verified.'})),assessments:[],evidence:[]};}
function complete(){
 const v=ledger();v.sections.forEach(s=>s.status='verified');v.phases.forEach(s=>s.status='verified');
 v.evidence=[{id:'ci-review',source_sha256:scan.source_sha256,implementation_sha256:snapshot,checked_at:'2026-09-09T00:00:00Z',reviewed_by:'fixture-reviewer',
 checks:[{run_id:123,head_sha:'b'.repeat(40),conclusion:'success',reference:'https://github.com/heke99/flexexa/actions/runs/123'}],covers:scan.points.map(p=>p.id),note:'Synthetic evidence only.'}];
 v.assessments=scan.points.map(p=>({point_id:p.id,status:'verified',evidence_ids:['ci-review'],note:'Fixture only.'}));return v;
}
test('every nonempty non-separator source line is retained including preamble, first and last sections',()=>{
 assert.equal(scan.sections.length,88);assert.equal(scan.phases.length,14);assert.equal(scan.point_count,source.split('\n').filter(l=>l.trim()).length);
 assert(scan.points.some(p=>p.section===-1&&p.text==='Preamble cannot disappear.'));assert(scan.points.some(p=>p.section===87&&p.text==='- field_87'));
});
test('duplicate text occurrences receive distinct deterministic IDs',()=>{
 const s=scanMasterplan(source.replace('- field_1','- repeat\n- repeat'));assert.equal(new Set(s.points.map(p=>p.id)).size,s.point_count);assert.deepEqual(s,scanMasterplan(source.replace('- field_1','- repeat\n- repeat')));
});
test('fenced code is retained without treating embedded headings as real sections',()=>{
 const s=scanMasterplan(source.replace('- field_0','~~~text\n# 900. fake\n- code_field\n~~~'));
 assert.equal(s.sections.length,88);assert(s.points.some(p=>p.text==='# 900. fake'&&p.kind==='code'&&p.section===0));
});
for(const [name,change] of [
 ['missing first',s=>s.replace('# 0. SECTION 0','# zero')],['missing last',s=>s.replace('# 87. SECTION 87','# last')],
 ['duplicate section',s=>s.replace('# 10. SECTION 10','# 9. duplicate')],['missing phase',s=>s.replace('Phase 13 — phase 13:','Phase last')],
 ['unclosed fence',s=>s+'\n~~~text\n'],['invalid UTF8 replacement',s=>s+'\uFFFD'],
])test(`source rejects ${name}`,()=>assert.throws(()=>scanMasterplan(change(source))));
test('green integrity does not assert any implementation or readiness',()=>{const r=assessMasterplan(scan,ledger(),snapshot);assert.equal(r.coverage_integrity,true);assert.equal(r.recorded_plan_ready,false);assert.equal(r.counts.verified,0);assert.equal(r.counts.unassessed,r.point_count);});
for(const [name,change] of [
 ['source drift',v=>v.source_sha256='c'.repeat(64)],['catalog drift',v=>v.catalog_sha256='c'.repeat(64)],['point omission',v=>v.point_count--],
 ['missing section',v=>v.sections.pop()],['duplicate section',v=>v.sections[2]=v.sections[1]],['missing phase',v=>v.phases.pop()],
 ['premature section',v=>v.sections[0].status='verified'],['premature phase',v=>v.phases[0].status='verified'],
 ['unknown field',v=>v.ignore_missing=true],['unknown status',v=>v.sections[0].status='not_applicable'],
 ['unknown point',v=>v.assessments.push({point_id:'lost',status:'partial',evidence_ids:[],note:'bad'})],
 ['unevidenced pass',v=>v.assessments.push({point_id:scan.points[0].id,status:'verified',evidence_ids:[],note:'bad'})],
])test(`ledger rejects ${name}`,()=>{const v=ledger();change(v);assert.throws(()=>assessMasterplan(scan,v,snapshot));});
for(const [name,change] of [
 ['stale code',v=>v.evidence[0].implementation_sha256='c'.repeat(64)],['uncovered point',v=>v.evidence[0].covers.pop()],
 ['failed CI',v=>v.evidence[0].checks[0].conclusion='failure'],['unrelated CI URL',v=>v.evidence[0].checks[0].reference='https://example.invalid'],
 ['missing reviewer',v=>v.evidence[0].reviewed_by=''],['missing checks',v=>v.evidence[0].checks=[]],
 ['duplicate assessment',v=>v.assessments.push(v.assessments[0])],['duplicate proof',v=>v.evidence.push(v.evidence[0])],
])test(`evidence rejects ${name}`,()=>{const v=complete();change(v);assert.throws(()=>assessMasterplan(scan,v,snapshot));});
test('complete recorded evidence is distinct from online verification and deployment authority',()=>{const result=assessMasterplan(scan,complete(),snapshot);assert.equal(result.recorded_plan_ready,true);assert(result.limitations.some(x=>x.includes('does not authenticate')));});
test('actual locked master is fully inventoried and no complete-phase status is invented',()=>{
 const actual=scanMasterplan(fs.readFileSync(path.join(root,'FLEXEXA_MASTER_BUILD_PROMPT_V1.md'),'utf8'));
 const v=JSON.parse(fs.readFileSync(path.join(root,'docs/progress/masterplan-coverage.json'),'utf8'));
 const report=assessMasterplan(actual,v,snapshot);assert.equal(report.recorded_plan_ready,false);assert.equal(report.sections.length,88);assert.equal(report.phases.length,14);
});

test('real CLI coverage succeeds but current whole-plan readiness refuses approval',()=>{
 const check=spawnSync(process.execPath,['scripts/quality/masterplan-report.mjs','--check'],{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(check.status,0,check.stderr);assert.equal(JSON.parse(check.stdout).recorded_plan_ready,false);
 const ready=spawnSync(process.execPath,['scripts/quality/masterplan-report.mjs','--require-ready'],{cwd:root,encoding:'utf8',timeout:10000});
 assert.equal(ready.status,2);assert.match(ready.stderr,/PLAN_NOT_READY/u);
});
test('unknown readiness flags do not silently downgrade to integrity-only',()=>{
 const result=spawnSync(process.execPath,['scripts/quality/masterplan-report.mjs','--ready'],{cwd:root,encoding:'utf8',timeout:10000});
 assert.notEqual(result.status,0);assert.match(result.stderr,/PLAN_ARGUMENT_INVALID/u);
});
test('plan or ledger edits require explicit whole-plan evidence review',()=>{
 const config=JSON.parse(fs.readFileSync(path.join(root,'.flexexa/impact-config.json'),'utf8'));
 for(const file of ['FLEXEXA_MASTER_BUILD_PROMPT_V1.md','docs/progress/masterplan-coverage.json']){
  const report=analyze({files:[file],dirty:false},{imports:[],packages:[],coverage:{unknowns:[]}},config);
  assert.equal(report.risk,'HIGH');assert(report.requiredChecks.includes('masterplan-source-and-evidence-review'));
 }
});
