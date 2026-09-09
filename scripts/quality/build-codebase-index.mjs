import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {workspacePackageName,workspaceExportTarget} from './index-core.mjs';
const root=process.cwd(),outDir=path.join(root,'.flexexa','index');
const sourceExts=new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs']);
const indexExts=new Set([...sourceExts,'.sql','.json','.yaml','.yml','.toml','.tf','.tfvars']);
const rel=p=>path.relative(root,p).split(path.sep).join('/');
const read=p=>fs.readFileSync(p,'utf8');
function writeJson(name,data){fs.mkdirSync(outDir,{recursive:true});fs.writeFileSync(path.join(outDir,name),JSON.stringify(data,null,2)+'\n');}
const fileNames=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const excluded=p=>p.startsWith('.flexexa/index/')||/(^|\/)\.env(?:\.|$)/u.test(p)||/\.(?:pem|key|p12|tfstate)$/u.test(p);
const unknowns=[];
const allFiles=[];
for(const name of [...new Set(fileNames)].sort()){
 if(excluded(name))continue;
 const file=path.join(root,name);
 if(!fs.existsSync(file)||!fs.lstatSync(file).isFile())continue;
 if(fs.statSync(file).size>1048576){if(indexExts.has(path.extname(file)))unknowns.push(name+': exceeds index size limit');continue;}
 allFiles.push(file);
}
const indexedFiles=allFiles.filter(p=>indexExts.has(path.extname(p)));
const packages=[],packageByName=new Map();
for(const file of allFiles.filter(p=>path.basename(p)==='package.json')){
 try{const value=JSON.parse(read(file));if(!value.name)continue;const item={name:value.name,path:rel(path.dirname(file)),exports:value.exports??null,dependencies:{...(value.dependencies??{}),...(value.devDependencies??{}),...(value.peerDependencies??{})}};packages.push(item);packageByName.set(item.name,item);}catch{unknowns.push(rel(file)+': malformed package manifest');}
}
function resolveRelative(importer,spec){
 if(!spec.startsWith('.'))return null;
 const base=path.resolve(path.dirname(importer),spec);
 const candidates=[base,...[...sourceExts].map(e=>base+e),...['index.ts','index.tsx','index.js','index.mjs'].map(f=>path.join(base,f))];
 const found=candidates.find(p=>fs.existsSync(p)&&fs.lstatSync(p).isFile());
 return found?rel(found):null;
}
const imports=[],envUsage=[],events=[],apiSurfaces=[],tests=[];
for(const file of allFiles){
 const rp=rel(file),ext=path.extname(file);
 if(/(?:^|\/)(?:__tests__|tests?|e2e)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(rp))tests.push(rp);
 if(sourceExts.has(ext)){
  const content=read(file);let m;
  if(/\b(?:import|require)\s*\(\s*(?!["'])(?:\S)/u.test(content))unknowns.push(rp+': dynamic module resolution');
  const importRegex=/(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']/gu;
  while((m=importRegex.exec(content))){
   let target=resolveRelative(file,m[1]);
   const workspaceName=workspacePackageName(m[1]),workspace=packageByName.get(workspaceName);
   if(workspace){
    const exportTarget=workspaceExportTarget(m[1],workspace);
    if(exportTarget){
     const directory=path.resolve(root,workspace.path),absolute=path.resolve(directory,exportTarget);
     if(absolute.startsWith(directory+path.sep)&&fs.existsSync(absolute)&&fs.lstatSync(absolute).isFile())target=rel(absolute);
    }
    if(!target)unknowns.push(rp+': unresolved workspace export '+m[1]);
    const owner=packages.filter(p=>p.path!==''&&rp.startsWith(p.path+'/')).sort((a,b)=>b.path.length-a.path.length)[0];
    if(owner&&owner.name!==workspaceName&&!Object.hasOwn(owner.dependencies,workspaceName))unknowns.push(rp+': undeclared workspace dependency '+workspaceName);
   }
   imports.push({from:rp,specifier:m[1],to:target,package:workspace?workspaceName:null});
  }
  const envRegex=/(?:process\.env\.|import\.meta\.env\.)([A-Z][A-Z0-9_]*)/gu;
  while((m=envRegex.exec(content)))envUsage.push({file:rp,key:m[1]});
  const eventRegex=/(?:eventType|event_type)\s*[:=]\s*["']([^"']+)["']|(?:publish|emit)\s*\(\s*["']([^"']+)["']/gu;
  while((m=eventRegex.exec(content)))events.push({file:rp,event:m[1]||m[2]});
 }
 if(rp.includes('/app/api/')||/(?:openapi|asyncapi)/iu.test(rp))apiSurfaces.push(rp);
 if(ext==='.py')unknowns.push(rp+': Python dependencies not parsed yet');
}
const sqlObjects=[],sqlReferences=[],infra=[];
for(const file of indexedFiles){
 const rp=rel(file),ext=path.extname(file);let m;
 if(ext==='.sql'){
  const content=read(file);
  const objects=/create\s+(?:or\s+replace\s+)?(table|view|materialized\s+view|function|trigger|policy|type)\s+(?:if\s+not\s+exists\s+)?(?:(["\w]+)\.)?["]?([\w]+)["]?/giu;
  while((m=objects.exec(content)))sqlObjects.push({file:rp,kind:m[1].toLowerCase(),schema:(m[2]||'public').replaceAll('"',''),name:m[3]});
  const refs=/(?:from|join|update|into|references)\s+(?:(["\w]+)\.)?["]?([\w]+)["]?/giu;
  while((m=refs.exec(content)))sqlReferences.push({file:rp,schema:(m[1]||'public').replaceAll('"',''),name:m[2]});
 }
 if(ext==='.tf'){const re=/resource\s+"([^"]+)"\s+"([^"]+)"/gu;while((m=re.exec(read(file))))infra.push({file:rp,kind:m[1],name:m[2]});}
 if(/(?:docker-compose|compose).*\.ya?ml$/iu.test(rp))infra.push({file:rp,kind:'docker-compose',name:path.basename(rp)});
}
const packageGraph=packages.map(p=>({...p,localDependencies:Object.keys(p.dependencies).filter(d=>packageByName.has(d))}));
for(const edge of imports){
 if(edge.specifier.startsWith('@flexexa/')&&!packageByName.has(workspacePackageName(edge.specifier)))unknowns.push(edge.from+': unresolved workspace subpath '+edge.specifier);
 if(!edge.to&&(edge.specifier.startsWith('.')||edge.specifier.startsWith('@/')))unknowns.push(edge.from+': '+edge.specifier);
}
const manifest={coverage:{mode:'syntactic-conservative',unknowns:[...new Set(unknowns)].sort(),limitations:['Source extraction is not complete semantic indexing','SQL/event/provider dependencies require dedicated tests','Changed workspace packages expand to declared reverse dependents']},generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fileCount:indexedFiles.length,packageCount:packages.length,importEdgeCount:imports.length,sqlObjectCount:sqlObjects.length,eventOccurrenceCount:events.length,testCount:tests.length};
writeJson('manifest.json',manifest);writeJson('package-graph.json',packageGraph);writeJson('import-graph.json',imports);writeJson('db-objects.json',{objects:sqlObjects,references:sqlReferences});writeJson('env-usage.json',envUsage);writeJson('event-topology.json',events);writeJson('api-contracts.json',apiSurfaces);writeJson('infra-resources.json',infra);writeJson('test-map.json',tests);
console.log(`Flexexa index: ${manifest.fileCount} files, ${manifest.importEdgeCount} import edges, ${manifest.sqlObjectCount} SQL objects, ${manifest.testCount} test files; coverage=${manifest.coverage.mode}.`);
