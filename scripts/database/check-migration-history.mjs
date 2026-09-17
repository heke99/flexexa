import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkMigrationHistory} from './migration-history.mjs';
const root=path.resolve(import.meta.dirname,'../..');
const ledgerPath='docs/quality/phase0-applied-sql-hashes.json',policyPath='docs/quality/development-migration-policy.json';
function read(file){return JSON.parse(fs.readFileSync(path.resolve(root,file),'utf8'));}
try{
 const options={};
 for(let i=process.argv[2]==='--'?3:2;i<process.argv.length;i+=2){
  const flag=process.argv[i],value=process.argv[i+1];
  if(!['--base','--snapshot'].includes(flag)||!value||value.startsWith('-')||options[flag])throw Error('HISTORY_INVALID_ARGUMENT');
  options[flag]=value;
 }
 const files=Object.fromEntries(fs.readdirSync(path.join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).map(f=>{
  const file=`supabase/migrations/${f}`;return [file,fs.readFileSync(path.join(root,file))];
 }));
 let baseLedger,basePolicy;
 if(options['--base']){
  const sha=execFileSync('git',['rev-parse','--verify',`${options['--base']}^{commit}`],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const paths=execFileSync('git',['ls-tree','-r','--name-only',sha],{cwd:root,encoding:'utf8'}).split('\n');
  if(paths.includes(ledgerPath))baseLedger=JSON.parse(execFileSync('git',['show',`${sha}:${ledgerPath}`],{cwd:root,encoding:'utf8'}));
  if(paths.includes(policyPath))basePolicy=JSON.parse(execFileSync('git',['show',`${sha}:${policyPath}`],{cwd:root,encoding:'utf8'}));
 }
 let snapshot;
 if(options['--snapshot']){
  if(fs.statSync(path.resolve(root,options['--snapshot'])).size>512*1024)throw Error('HISTORY_SNAPSHOT_TOO_LARGE');
  snapshot=read(options['--snapshot']);
 }
 console.log(JSON.stringify(checkMigrationHistory({files,ledger:read(ledgerPath),policy:read(policyPath),baseLedger,basePolicy,snapshot})));
}catch(error){
 console.error(/^HISTORY_[A-Z_]+$/u.test(error.message)?error.message:'HISTORY_CHECK_FAILED');process.exitCode=1;
}
