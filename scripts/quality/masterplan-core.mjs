import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>{throw Error(code);};
function object(value){if(!value||typeof value!=='object'||Array.isArray(value))fail('PLAN_OBJECT_REQUIRED');return value;}
function keys(value,allowed){object(value);if(Object.keys(value).some(k=>!allowed.includes(k)))fail('PLAN_UNKNOWN_FIELD');}
function unique(items,key){if(new Set(items.map(key)).size!==items.length)fail('PLAN_DUPLICATE_ID');}
const text=value=>typeof value==='string'&&value.trim().length>0;
const sha=value=>typeof value==='string'&&/^[a-f0-9]{64}$/u.test(value);

/** Source points retain context and exact text. They are NOT a count of atomic requirements. */
export function scanMasterplan(source){
 if(typeof source!=='string'||!source||source.includes('\uFFFD'))fail('PLAN_SOURCE_INVALID');
 const sections=[],phases=[],points=[],occurrences=new Map();let section=-1,phase=null,fence=null;
 for(const [index,line] of source.split('\n').entries()){
  const marker=line.match(/^(`{3,}|~{3,})(.*)$/u);
  let kind=fence?'code':'text';
  if(marker){
   if(!fence){fence=marker[1];kind='code';}
   else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length&&marker[2].trim()===''){fence=null;kind='code';}
  } else if(!fence){
   const heading=line.match(/^# (\d+)\. (.+)$/u);
   if(heading){section=Number(heading[1]);phase=null;sections.push({id:section,title:heading[2],line:index+1});kind='section';}
   const phaseHeading=section===83?line.match(/^Phase (\d+) — (.+):$/u):null;
   if(phaseHeading){phase=Number(phaseHeading[1]);phases.push({id:phase,title:phaseHeading[2],line:index+1});kind='phase';}
  }
  if(!line.trim()||(!fence&&kind!=='code'&&/^---+$/u.test(line)))continue;
  const digest=hash(`${section}\0${line}`),occurrence=(occurrences.get(digest)??0)+1;
  occurrences.set(digest,occurrence);
  points.push({id:`${section<0?'PRE':`S${String(section).padStart(2,'0')}`}-${digest.slice(0,16)}-${occurrence}`,
   section,phase,line:index+1,kind,text:line,sha256:hash(line)});
 }
 if(fence)fail('PLAN_UNCLOSED_CODE_FENCE');
 if(sections.length!==88||sections.some((s,i)=>s.id!==i))fail('PLAN_SECTION_SEQUENCE');
 if(phases.length!==14||phases.some((p,i)=>p.id!==i))fail('PLAN_PHASE_SEQUENCE');
 unique(points,p=>p.id);
 return {source_sha256:hash(source),catalog_sha256:hash(JSON.stringify(points)),point_count:points.length,sections,phases,points};
}

/** Validates recorded coverage and evidence integrity, not the truth of a remote test or legal approval. */
export function assessMasterplan(scan,ledger,implementationSha){
 keys(ledger,['schema_version','source_path','source_sha256','catalog_sha256','point_count','sections','phases','assessments','evidence']);
 if(ledger.schema_version!==1||ledger.source_path!=='FLEXEXA_MASTER_BUILD_PROMPT_V1.md'||!sha(implementationSha))fail('PLAN_SCHEMA_INVALID');
 if(ledger.source_sha256!==scan.source_sha256||ledger.catalog_sha256!==scan.catalog_sha256||ledger.point_count!==scan.point_count)fail('PLAN_SOURCE_DRIFT');
 for(const name of ['sections','phases','assessments','evidence'])if(!Array.isArray(ledger[name]))fail('PLAN_ARRAY_REQUIRED');
 const lookup=new Map(scan.points.map(p=>[p.id,p]));
 const states=new Map(),evidence=new Map();
 unique(ledger.assessments,a=>object(a).point_id);unique(ledger.evidence,e=>object(e).id);
 for(const e of ledger.evidence){
  keys(e,['id','source_sha256','implementation_sha256','checked_at','reviewed_by','checks','covers','note']);
  if(!text(e.id)||!sha(e.implementation_sha256)||e.source_sha256!==scan.source_sha256||!text(e.reviewed_by)||!text(e.note)||
   typeof e.checked_at!=='string'||!/^\d{4}-\d{2}-\d{2}T.*Z$/u.test(e.checked_at)||!Number.isFinite(Date.parse(e.checked_at)))fail('PLAN_EVIDENCE_INVALID');
  if(!Array.isArray(e.covers)||!e.covers.length||!Array.isArray(e.checks)||!e.checks.length)fail('PLAN_EVIDENCE_EMPTY');
  unique(e.covers,x=>x);
  if(e.covers.some(id=>!lookup.has(id)))fail('PLAN_EVIDENCE_SCOPE_INVALID');
  for(const check of e.checks){
   keys(check,['run_id','head_sha','conclusion','reference']);
   if(!Number.isSafeInteger(check.run_id)||check.run_id<1||typeof check.head_sha!=='string'||!/^[a-f0-9]{40}$/u.test(check.head_sha)||
    check.conclusion!=='success'||check.reference!==`https://github.com/heke99/flexexa/actions/runs/${check.run_id}`)fail('PLAN_CHECK_EVIDENCE_INVALID');
  }
  evidence.set(e.id,e);
 }
 for(const a of ledger.assessments){
  keys(a,['point_id','status','evidence_ids','note']);
  if(!lookup.has(a.point_id)||!['unassessed','partial','blocked','verified'].includes(a.status)||!text(a.note)||!Array.isArray(a.evidence_ids))fail('PLAN_ASSESSMENT_INVALID');
  unique(a.evidence_ids,x=>x);
  for(const id of a.evidence_ids)if(!evidence.has(id)||!evidence.get(id).covers.includes(a.point_id))fail('PLAN_EVIDENCE_SCOPE_INVALID');
  if(a.status==='verified'){
   if(!a.evidence_ids.length)fail('PLAN_VERIFIED_WITHOUT_EVIDENCE');
   if(a.evidence_ids.some(id=>evidence.get(id).implementation_sha256!==implementationSha))fail('PLAN_STALE_EVIDENCE');
  }
  states.set(a.point_id,a.status);
 }
 for(const [name,expected] of [['sections',scan.sections],['phases',scan.phases]]){
  const values=ledger[name];unique(values,x=>object(x).id);
  if(values.length!==expected.length)fail('PLAN_MISSING_SCOPE');
  for(const [i,value] of values.entries()){
   keys(value,['id','status','note']);
   if(value.id!==expected[i].id||!['planned','partial','blocked','verified'].includes(value.status)||!text(value.note))fail('PLAN_SCOPE_INVALID');
   const relevant=scan.points.filter(p=>name==='sections'?p.section===value.id:p.phase===value.id);
   if(value.status==='verified'&&relevant.some(p=>states.get(p.id)!=='verified'))fail('PLAN_SCOPE_PREMATURE');
  }
 }
 const counts={unassessed:0,partial:0,blocked:0,verified:0};
 const points=scan.points.map(p=>{const status=states.get(p.id)??'unassessed';counts[status]++;return {...p,status};});
 return {source_sha256:scan.source_sha256,implementation_sha256:implementationSha,coverage_integrity:true,
  recorded_plan_ready:counts.verified===points.length&&ledger.sections.every(s=>s.status==='verified')&&ledger.phases.every(p=>p.status==='verified'),
  point_count:points.length,counts,sections:ledger.sections,phases:ledger.phases,points,
  limitations:['Source points preserve source lines, not independent semantic requirement counts.',
   'Evidence records must be imported only after actual CI, resource review and external approval verification.',
   'This offline validator checks recorded scope and hashes; it does not authenticate GitHub evidence or authorize deployment.',
   'A green coverage check never means a phase, live provider, electrical control or market role is ready.']};
}
