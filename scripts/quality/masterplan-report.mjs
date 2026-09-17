import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {scanMasterplan,assessMasterplan} from './masterplan-core.mjs';
const root=path.resolve(import.meta.dirname,'../..'),args=process.argv.slice(2);
if(args.some(a=>!['--check','--require-ready'].includes(a))||args.length!==new Set(args).size)throw Error('PLAN_ARGUMENT_INVALID');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const files=execFileSync('git',['ls-files','--cached','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean).sort();
const digest=createHash('sha256');
for(const file of files){
 // Evidence/status documents do not change the implementation they describe; all other tracked content does.
 if(file.startsWith('docs/progress/')||file.startsWith('.flexexa/index/'))continue;
 if(file.includes('..')||path.isAbsolute(file)||(/(?:^|\/)\.env(?:\.|$)/u.test(file)&&file!=='.env.example')||/\.(?:pem|key|p12|tfstate)$/u.test(file))throw Error('PLAN_UNSAFE_TRACKED_PATH');
 const absolute=path.join(root,file);
 if(!fs.lstatSync(absolute).isFile())throw Error('PLAN_NONREGULAR_SOURCE');
 const bytes=fs.readFileSync(absolute);digest.update(`${file}\0${bytes.length}\0`);digest.update(bytes);
}
const scan=scanMasterplan(read('FLEXEXA_MASTER_BUILD_PROMPT_V1.md'));
const report=assessMasterplan(scan,JSON.parse(read('docs/progress/masterplan-coverage.json')),digest.digest('hex'));
report.clean_worktree=execFileSync('git',['status','--porcelain','--untracked-files=all'],{cwd:root,encoding:'utf8'}).trim()==='';
report.recorded_plan_ready &&= report.clean_worktree;
const output=path.join(root,'.flexexa/index/masterplan-report.json');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({coverage_integrity:report.coverage_integrity,sections:scan.sections.length,phases:scan.phases.length,
 source_points:report.point_count,point_assessments:report.counts,recorded_plan_ready:report.recorded_plan_ready,clean_worktree:report.clean_worktree}));
if(args.includes('--require-ready')&&!report.recorded_plan_ready){console.error('PLAN_NOT_READY: unverified points/phases or uncommitted source remain.');process.exitCode=2;}
