import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const outDir = path.join(root, ".flexexa", "index");
const excludedDirs = new Set([".git","node_modules",".next",".turbo","dist","coverage",".vercel",".pnpm-store"]);
const sourceExts = new Set([".ts",".tsx",".js",".jsx",".mjs",".cjs"]);
const indexExts = new Set([...sourceExts,".sql",".json",".yaml",".yml",".toml",".tf",".tfvars"]);

function walk(dir, acc=[]) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    const abs=path.join(dir,entry.name);
    if (entry.isDirectory()) walk(abs,acc);
    else acc.push(abs);
  }
  return acc;
}
function rel(p){ return path.relative(root,p).split(path.sep).join("/"); }
function read(p){ try{return fs.readFileSync(p,"utf8");}catch{return "";} }
function writeJson(name,data){
  fs.mkdirSync(outDir,{recursive:true});
  fs.writeFileSync(path.join(outDir,name),JSON.stringify(data,null,2)+"\n");
}
function git(args){
  try{return execFileSync("git",args,{cwd:root,encoding:"utf8"}).trim();}catch{return null;}
}

const allFiles=walk(root).filter(p=>!rel(p).startsWith(".flexexa/index/"));
const indexedFiles=allFiles.filter(p=>indexExts.has(path.extname(p)) || path.basename(p)==="package.json");
const packageFiles=allFiles.filter(p=>path.basename(p)==="package.json" && !rel(p).includes("node_modules/"));
const packages=[];
const packageByName=new Map();

for(const file of packageFiles){
  try{
    const json=JSON.parse(read(file));
    if(!json.name) continue;
    const item={name:json.name,path:rel(path.dirname(file)),dependencies:{
      ...(json.dependencies||{}),...(json.devDependencies||{}),...(json.peerDependencies||{})
    }};
    packages.push(item); packageByName.set(item.name,item);
  }catch{}
}

function resolveRelative(importer,spec){
  if(!spec.startsWith(".")) return null;
  const base=path.resolve(path.dirname(importer),spec);
  const candidates=[base,...[...sourceExts].map(e=>base+e),...["index.ts","index.tsx","index.js","index.mjs"].map(f=>path.join(base,f))];
  const found=candidates.find(p=>fs.existsSync(p) && fs.statSync(p).isFile());
  return found?rel(found):null;
}

const imports=[];
const envUsage=[];
const events=[];
const apiSurfaces=[];
const tests=[];
for(const file of allFiles){
  const rp=rel(file), ext=path.extname(file), text=read(file);
  if(/(?:^|\/)(?:__tests__|tests?|e2e)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(rp)) tests.push(rp);
  if(sourceExts.has(ext)){
    const importRegex=/(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;
    let m; while((m=importRegex.exec(text))){
      const target=resolveRelative(file,m[1]);
      imports.push({from:rp,specifier:m[1],to:target,package:target?null:(packageByName.has(m[1])?m[1]:null)});
    }
    const envRegex=/(?:process\.env\.|import\.meta\.env\.)([A-Z][A-Z0-9_]*)/g;
    while((m=envRegex.exec(text))) envUsage.push({file:rp,key:m[1]});
    const eventRegex=/(?:eventType|event_type)\s*[:=]\s*["']([^"']+)["']|(?:publish|emit)\s*\(\s*["']([^"']+)["']/g;
    while((m=eventRegex.exec(text))) events.push({file:rp,event:m[1]||m[2]});
  }
  if(rp.includes("/app/api/") || /(?:openapi|asyncapi)/i.test(rp)) apiSurfaces.push(rp);
}

const sqlObjects=[], sqlReferences=[];
for(const file of allFiles.filter(p=>path.extname(p)===".sql")){
  const rp=rel(file), text=read(file);
  let m;
  const objectRegex=/create\s+(?:or\s+replace\s+)?(table|view|materialized\s+view|function|trigger|policy|type)\s+(?:if\s+not\s+exists\s+)?(?:(["\w]+)\.)?["]?([\w]+)["]?/gi;
  while((m=objectRegex.exec(text))) sqlObjects.push({file:rp,kind:m[1].toLowerCase(),schema:(m[2]||"public").replaceAll('"',""),name:m[3]});
  const refRegex=/(?:from|join|update|into|references)\s+(?:(["\w]+)\.)?["]?([\w]+)["]?/gi;
  while((m=refRegex.exec(text))) sqlReferences.push({file:rp,schema:(m[1]||"public").replaceAll('"',""),name:m[2]});
}

const infra=[];
for(const file of allFiles){
  const rp=rel(file), text=read(file);
  if(path.extname(file)===".tf"){
    let m; const re=/resource\s+"([^"]+)"\s+"([^"]+)"/g;
    while((m=re.exec(text))) infra.push({file:rp,kind:m[1],name:m[2]});
  }
  if(/docker-compose.*\.ya?ml$/i.test(rp)) infra.push({file:rp,kind:"docker-compose",name:path.basename(rp)});
}

const localPackageNames=new Set(packages.map(p=>p.name));
const packageGraph=packages.map(p=>({
  ...p,
  localDependencies:Object.keys(p.dependencies).filter(d=>localPackageNames.has(d))
}));

const manifest={
  generatedAt:new Date().toISOString(),
  commit:git(["rev-parse","HEAD"]),
  fileCount:indexedFiles.length,
  packageCount:packages.length,
  importEdgeCount:imports.length,
  sqlObjectCount:sqlObjects.length,
  eventOccurrenceCount:events.length,
  testCount:tests.length
};

writeJson("manifest.json",manifest);
writeJson("package-graph.json",packageGraph);
writeJson("import-graph.json",imports);
writeJson("db-objects.json",{objects:sqlObjects,references:sqlReferences});
writeJson("env-usage.json",envUsage);
writeJson("event-topology.json",events);
writeJson("api-contracts.json",apiSurfaces);
writeJson("infra-resources.json",infra);
writeJson("test-map.json",tests);
console.log("Flexexa index: "+manifest.fileCount+" files, "+manifest.importEdgeCount+" import edges, "+manifest.sqlObjectCount+" SQL objects, "+manifest.testCount+" tests.");
