import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const root=process.cwd();
const applicationOnly=process.argv.includes('--application-only');
const i=process.argv.indexOf('--base'),base=i<0?(process.env.IMPACT_BASE||'origin/main'):process.argv[i+1];
function run(command,args){
 console.log(`> ${command} ${args.join(' ')}`);
 const result=spawnSync(command,args,{cwd:root,stdio:'inherit',shell:false});
 if(result.error) throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
run(process.execPath,['scripts/quality/impact-analysis.mjs','--base',base]);
const report=JSON.parse(fs.readFileSync(path.join(root,'.flexexa/index/impact-report.json'),'utf8'));
run(process.execPath,['--test','scripts/quality/impact.test.mjs']);
const tasks=['lint','typecheck','test','build'];
if(report.fullSuiteRequired){for(const task of tasks)run('pnpm',[task]);}
else run('pnpm',['exec','turbo','run',...tasks,...report.impactedPackages.map(p=>`--filter=${p}`)]);
const pending=report.requiredChecks.filter(c=>!['application','canonical-contract-tests'].includes(c));
const result={head:report.head,mergeBase:report.mergeBase,scope:'application',applicationPassed:true,pendingSpecializedChecks:pending,fullyVerified:pending.length===0};
fs.writeFileSync(path.join(root,'.flexexa/index/verification-report.json'),JSON.stringify(result,null,2)+'\n');
console.log('Application checks passed (lint, typecheck, real tests, build).');
if(pending.length){
 console.log(`NOT full verification. Separate checks still required: ${pending.join(', ')}`);
 if(!applicationOnly)process.exit(2);
}
