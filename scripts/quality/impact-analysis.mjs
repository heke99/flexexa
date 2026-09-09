import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root=process.cwd();
const outDir=path.join(root,".flexexa","index");
function arg(name, fallback){
  const i=process.argv.indexOf(name); return i>=0 && process.argv[i+1]?process.argv[i+1]:fallback;
}
function git(args){
  return execFileSync("git",args,{cwd:root,encoding:"utf8"}).trim();
}
function ensureIndex(){
  const p=path.join(outDir,"import-graph.json");
  if(!fs.existsSync(p)) execFileSync(process.execPath,[path.join(root,"scripts/quality/build-codebase-index.mjs")],{cwd:root,stdio:"inherit"});
}
function load(name){return JSON.parse(fs.readFileSync(path.join(outDir,name),"utf8"));}
function changedFiles(base){
  const envBase=process.env.GITHUB_BASE_REF ? "origin/"+process.env.GITHUB_BASE_REF : null;
  const candidates=[base,envBase,"origin/main","HEAD^"].filter(Boolean);
  for(const c of candidates){
    try{
      const out=git(["diff","--name-only",c+"...HEAD"]);
      return {base:c,files:out?out.split("\n").filter(Boolean):[]};
    }catch{}
  }
  return {base:"HEAD^",files:[]};
}
function riskFor(file){
  const high=[
    /^packages\/(domain|kernel|events|api-contracts)\//,
    /^supabase\/migrations\//,/^infra\//,/^opentofu\//,/\.tf$/,
    /(^|\/)(rls|rbac|rules|policy|optimizer|dispatch|settlement|ledger|reservation|flex)(\/|\.|-)/i,
    /^\.github\/workflows\//
  ];
  if(high.some(r=>r.test(file))) return "HIGH";
  if(/^(apps|services|packages|scripts\/quality|docker|compose)/.test(file)) return "MEDIUM";
  return "LOW";
}
const rank={LOW:1,MEDIUM:2,HIGH:3};

ensureIndex();
const requested=arg("--base",process.env.IMPACT_BASE||"origin/main");
const diff=changedFiles(requested);
const imports=load("import-graph.json");
const tests=new Set(load("test-map.json"));

const reverse=new Map();
for(const e of imports){
  if(!e.to) continue;
  if(!reverse.has(e.to)) reverse.set(e.to,new Set());
  reverse.get(e.to).add(e.from);
}
const impacted=new Set(diff.files);
const queue=[...diff.files];
while(queue.length){
  const cur=queue.shift();
  for(const dep of reverse.get(cur)||[]){
    if(!impacted.has(dep)){impacted.add(dep);queue.push(dep);}
  }
}
let risk="LOW";
const reasons=[];
for(const f of diff.files){
  const r=riskFor(f);
  if(rank[r]>rank[risk]) risk=r;
  if(r==="HIGH") reasons.push("high-risk path: "+f);
}
const requiredChecks=new Set(["index","impact"]);
if(risk==="HIGH"){requiredChecks.add("full-typecheck");requiredChecks.add("full-test");requiredChecks.add("full-build");}
else {requiredChecks.add("turbo-affected");}
if(diff.files.some(f=>f.startsWith("supabase/"))){requiredChecks.add("migration-replay");requiredChecks.add("rls-two-tenant");requiredChecks.add("supabase-advisors");}
if(diff.files.some(f=>/^packages\/(events|api-contracts|domain)\//.test(f))){requiredChecks.add("contract-compatibility");}
if(diff.files.some(f=>/^(infra|opentofu)\/|\.tf$/.test(f))){requiredChecks.add("iam-security-review");requiredChecks.add("tofu-plan");}
if(diff.files.some(f=>/(settlement|ledger)/i.test(f))){requiredChecks.add("idempotency");requiredChecks.add("ledger-balance");}
if(diff.files.some(f=>/(reservation|flex)/i.test(f))){requiredChecks.add("concurrency-no-oversubscription");}
if(diff.files.some(f=>/\.tsx$|apps\/web\//.test(f))){requiredChecks.add("browser-e2e");}

const report={
  generatedAt:new Date().toISOString(),
  base:diff.base,
  head:git(["rev-parse","HEAD"]),
  risk,
  fullSuiteRequired:risk==="HIGH",
  changedFiles:diff.files,
  impactedFiles:[...impacted].sort(),
  impactedTests:[...impacted].filter(f=>tests.has(f)).sort(),
  requiredChecks:[...requiredChecks],
  reasons:[...new Set(reasons)]
};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,"impact-report.json"),JSON.stringify(report,null,2)+"\n");
console.log("Flexexa impact: "+risk+" — "+report.changedFiles.length+" changed, "+report.impactedFiles.length+" changed/transitive files.");
console.log("Required checks: "+report.requiredChecks.join(", "));
