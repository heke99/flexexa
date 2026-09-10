import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {checkMigrationHistory} from '../database/migration-history.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const file='supabase/migrations/20260101000000_initial.sql';
const now=Date.parse('2026-09-10T08:00:00Z');
function fixture(){
 const ledger={files:{[file]:hash('select 1;\n')}};
 return {files:{[file]:'select 1;\n'},ledger,baseLedger:structuredClone(ledger),
  policy:{schema_version:1,project_id:'abcdefghijklmnopqrst',historical_exceptions:{}},now,
  snapshot:{project_id:'abcdefghijklmnopqrst',captured_at:new Date(now).toISOString(),
   migrations:[{version:'20260101000000',name:'initial',bytes:10,sha256:hash('select 1;\n')}]}};
}
test('exact history match proves history only, not schema or readiness',()=>{
 const r=checkMigrationHistory(fixture());assert.equal(r.liveHistoryVerified,true);assert.equal(r.liveSchemaVerified,false);assert.equal(r.tracked,1);
});
test('local CI never claims fresh live verification',()=>{
 const v=fixture();delete v.snapshot;assert.equal(checkMigrationHistory(v).liveHistoryVerified,false);
});
test('new future candidate is allowed locally but cannot pass promotion unpinned',()=>{
 const v=fixture(),next='supabase/migrations/20260102000000_next.sql';v.files[next]='select 2;\n';
 const snapshot=v.snapshot;delete v.snapshot;assert.deepEqual(checkMigrationHistory(v).pending,['20260102000000']);
 v.snapshot=snapshot;v.snapshot.migrations.push({version:'20260102000000',name:'next',bytes:10,sha256:hash(v.files[next])});
 assert.throws(()=>checkMigrationHistory(v),/HISTORY_UNPINNED_PROMOTION/);
 v.ledger.files[next]=hash(v.files[next]);assert.equal(checkMigrationHistory(v).liveHistoryVerified,true);
});
for(const [name,mutate,code] of [
 ['changed applied SQL',v=>v.files[file]='select 2;\n','HISTORY_APPLIED_SOURCE_CHANGED'],
 ['deleted applied SQL',v=>{v.files={};},'HISTORY_INVALID_SOURCE'],
 ['rewritten SQL and ledger together',v=>{v.files[file]='select 2;\n';v.ledger.files[file]=hash(v.files[file]);},'HISTORY_BASE_REWRITTEN'],
 ['removed ledger pin',v=>{v.ledger.files={};},'HISTORY_EMPTY_LEDGER'],
 ['duplicate source version',v=>{v.files['supabase/migrations/20260101000000_duplicate.sql']='select 2;';},'HISTORY_DUPLICATE_VERSION'],
 ['backdated candidate',v=>{v.files['supabase/migrations/20250101000000_old.sql']='select 2;';},'HISTORY_BACKDATED_MIGRATION'],
 ['backdated pinned candidate',v=>{const p='supabase/migrations/20250101000000_old.sql';v.files[p]='select 2;';v.ledger.files[p]=hash(v.files[p]);},'HISTORY_BACKDATED_MIGRATION'],
 ['invalid source path',v=>{v.files['../outside.sql']='select 1;';},'HISTORY_INVALID_FILE'],
 ['missing remote migration',v=>v.snapshot.migrations.pop(),'HISTORY_VERSION_SET_MISMATCH'],
 ['extra remote migration',v=>v.snapshot.migrations.push({...v.snapshot.migrations[0],version:'20260102000000'}),'HISTORY_VERSION_SET_MISMATCH'],
 ['renamed remote migration',v=>v.snapshot.migrations[0].name='other','HISTORY_VERSION_SET_MISMATCH'],
 ['changed remote SQL',v=>v.snapshot.migrations[0].sha256=hash('different'),'HISTORY_RECORDED_SQL_CHANGED'],
 ['changed remote byte count',v=>v.snapshot.migrations[0].bytes=11,'HISTORY_RECORDED_SQL_CHANGED'],
 ['wrong project',v=>v.snapshot.project_id='wrong','HISTORY_WRONG_PROJECT'],
 ['stale snapshot',v=>v.snapshot.captured_at=new Date(now-900001).toISOString(),'HISTORY_STALE_SNAPSHOT'],
 ['future snapshot',v=>v.snapshot.captured_at=new Date(now+1).toISOString(),'HISTORY_STALE_SNAPSHOT'],
 ['invalid snapshot time',v=>v.snapshot.captured_at='bad','HISTORY_STALE_SNAPSHOT'],
 ['unknown snapshot field',v=>v.snapshot.ignore_checks=true,'HISTORY_INVALID_SHAPE'],
 ['unreviewed policy edit',v=>{v.basePolicy=structuredClone(v.policy);v.policy.project_id='aaaaaaaaaaaaaaaaaaaa';},'HISTORY_POLICY_CHANGED'],
 ['malformed exception',v=>v.policy.historical_exceptions['20260101000000']={ignore:true},'HISTORY_INVALID_SHAPE'],
])test(`migration sync rejects ${name}`,()=>{const v=fixture();mutate(v);assert.throws(()=>checkMigrationHistory(v),new RegExp(code));});
test('reviewed exception binds exact source AND exact recorded bytes; whitespace is not generally ignored',()=>{
 const v=fixture(),recorded='select  1;\n';
 v.policy.historical_exceptions['20260101000000']={source_sha256:hash(v.files[file]),recorded_sha256:hash(recorded),recorded_bytes:11,reason:'Reviewed fixture'};
 v.snapshot.migrations[0]={...v.snapshot.migrations[0],sha256:hash(recorded),bytes:11};
 assert.equal(checkMigrationHistory(v).liveHistoryVerified,true);
 v.snapshot.migrations[0].sha256=hash('select   1;\n');assert.throws(()=>checkMigrationHistory(v),/HISTORY_RECORDED_SQL_CHANGED/);
});
test('duplicate remote version cannot disguise a missing version',()=>{
 const v=fixture(),next='supabase/migrations/20260102000000_next.sql';v.files[next]='select 2;\n';v.ledger.files[next]=hash(v.files[next]);
 v.snapshot.migrations.push({...v.snapshot.migrations[0]});assert.throws(()=>checkMigrationHistory(v),/HISTORY_DUPLICATE_VERSION/);
});
