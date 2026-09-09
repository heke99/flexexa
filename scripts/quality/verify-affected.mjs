import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root=process.cwd();
function arg(name,fallback){const i=process.argv.indexOf(name);return i>=0&&process.argv[i+1]?process.argv[i+1]:fallback;}
function run(cmd,args){
  console.log("> "+cmd+" "+args.join(" "));
  const r=spawnSync(cmd,args,{cwd:root,stdio:"inherit",shell:process.platform==="win32"});
  if(r.status!==0) process.exit(r.status??1);
}
const base=arg("--base",process.env.IMPACT_BASE||"origin/main");
run(process.execPath,[path.join(root,"scripts/quality/impact-analysis.mjs"),"--base",base]);
const report=JSON.parse(fs.readFileSync(path.join(root,".flexexa/index/impact-report.json"),"utf8"));
run(process.execPath,["--test","scripts/quality/tests/impact.test.mjs"]);
if(report.fullSuiteRequired){
  run("pnpm",["typecheck"]);run("pnpm",["test"]);run("pnpm",["build"]);
}else{
  process.env.TURBO_SCM_BASE=report.base;process.env.TURBO_SCM_HEAD=report.head;
  run("pnpm",["exec","turbo","typecheck","test","build","--affected"]);
}
console.log("Application checks completed at risk "+report.risk+". This is not full phase verification.");
const basic=new Set(["full-typecheck","full-test","full-build","turbo-affected"]);
const specialized=report.requiredChecks.filter(x=>!basic.has(x));
if(specialized.length){
  console.log("Additional independent checks required: "+specialized.join(", "));
  if(!process.argv.includes("--application-only")){
    console.error("VERIFICATION_INCOMPLETE: run independent domain checks; --application-only is for CI job separation, not completion approval.");
    process.exit(2);
  }
}
