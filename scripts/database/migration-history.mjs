import {createHash} from 'node:crypto';
const filePattern=/^supabase\/migrations\/(\d{14})_([a-z][a-z0-9_]*)\.sql$/u;
const hashPattern=/^[a-f0-9]{64}$/u;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fail=code=>{throw new Error(code);};
function keys(value,expected){
 if(!object(value)||Object.keys(value).sort().join(',')!==[...expected].sort().join(','))fail('HISTORY_INVALID_SHAPE');
}
export function checkMigrationHistory({files,ledger,policy,baseLedger,basePolicy,snapshot,now=Date.now()}){
 if(!object(files)||!object(ledger?.files)||!Object.keys(files).length)fail('HISTORY_INVALID_SOURCE');
 keys(policy,['schema_version','project_id','historical_exceptions']);
 if(policy.schema_version!==1||!/^[a-z]{20}$/u.test(policy.project_id)||!object(policy.historical_exceptions))fail('HISTORY_INVALID_POLICY');
 const source=Object.entries(files).map(([file,content])=>{
  const match=filePattern.exec(file);
  if(!match||!(typeof content==='string'||Buffer.isBuffer(content)))fail('HISTORY_INVALID_FILE');
  return {file,version:match[1],name:match[2],sha256:createHash('sha256').update(content).digest('hex'),bytes:Buffer.byteLength(content)};
 }).sort((a,b)=>a.version.localeCompare(b.version));
 if(new Set(source.map(m=>m.version)).size!==source.length)fail('HISTORY_DUPLICATE_VERSION');
 for(const [file,hash] of Object.entries(ledger.files)){
  if(!hashPattern.test(hash)||source.find(m=>m.file===file)?.sha256!==hash)fail('HISTORY_APPLIED_SOURCE_CHANGED');
 }
 if(!Object.keys(ledger.files).length)fail('HISTORY_EMPTY_LEDGER');
 if(baseLedger){
  if(!object(baseLedger.files))fail('HISTORY_INVALID_BASE');
  for(const [file,hash] of Object.entries(baseLedger.files))if(ledger.files[file]!==hash)fail('HISTORY_BASE_REWRITTEN');
  const latest=Object.keys(baseLedger.files).map(file=>filePattern.exec(file)?.[1]??fail('HISTORY_INVALID_BASE')).sort().at(-1);
  if(source.some(m=>!(m.file in baseLedger.files)&&m.version<=latest))fail('HISTORY_BACKDATED_MIGRATION');
 }
 // Existing exceptions are a fixed reviewed baseline, never a growing normalization bypass.
 if(basePolicy&&JSON.stringify(policy)!==JSON.stringify(basePolicy))fail('HISTORY_POLICY_CHANGED');
 let pendingStarted=false;
 for(const m of source){
  if(!(m.file in ledger.files))pendingStarted=true;
  else if(pendingStarted)fail('HISTORY_BACKDATED_MIGRATION');
 }
 for(const [version,exception] of Object.entries(policy.historical_exceptions)){
  keys(exception,['source_sha256','recorded_sha256','recorded_bytes','reason']);
  const m=source.find(row=>row.version===version);
  if(!m||ledger.files[m.file]!==exception.source_sha256||!hashPattern.test(exception.recorded_sha256)||
   exception.recorded_sha256===exception.source_sha256||!Number.isSafeInteger(exception.recorded_bytes)||exception.recorded_bytes<=0||
   typeof exception.reason!=='string'||!exception.reason.trim())fail('HISTORY_INVALID_EXCEPTION');
 }
 const result={tracked:source.length,pinned:Object.keys(ledger.files).length,pending:source.filter(m=>!(m.file in ledger.files)).map(m=>m.version),
  reviewedHistoricalExceptions:Object.keys(policy.historical_exceptions).length,liveHistoryVerified:false,liveSchemaVerified:false};
 if(snapshot===undefined)return result;
 keys(snapshot,['project_id','captured_at','migrations']);
 if(snapshot.project_id!==policy.project_id)fail('HISTORY_WRONG_PROJECT');
 const captured=typeof snapshot.captured_at==='string'?Date.parse(snapshot.captured_at):NaN;
 if(!Number.isFinite(now)||!Number.isFinite(captured)||captured>now||now-captured>15*60*1000)fail('HISTORY_STALE_SNAPSHOT');
 if(!Array.isArray(snapshot.migrations)||snapshot.migrations.length!==source.length)fail('HISTORY_VERSION_SET_MISMATCH');
 if(result.pending.length)fail('HISTORY_UNPINNED_PROMOTION');
 const seen=new Set();
 for(const row of snapshot.migrations){
  keys(row,['version','name','bytes','sha256']);
  if(typeof row.version!=='string'||seen.has(row.version))fail('HISTORY_DUPLICATE_VERSION');
  seen.add(row.version);
  const m=source.find(item=>item.version===row.version),exception=policy.historical_exceptions[row.version];
  if(!m||row.name!==m.name)fail('HISTORY_VERSION_SET_MISMATCH');
  if(row.sha256!==(exception?.recorded_sha256??m.sha256)||row.bytes!==(exception?.recorded_bytes??m.bytes))fail('HISTORY_RECORDED_SQL_CHANGED');
 }
 return {...result,liveHistoryVerified:true,capturedAt:snapshot.captured_at};
}
