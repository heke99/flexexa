import { execFileSync } from 'node:child_process';
export function changedFiles(root, requestedBase) {
  if (!requestedBase || typeof requestedBase !== 'string') throw new Error('BASE_REF_REQUIRED');
  const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  let base, head, mergeBase;
  try {
    base=git('rev-parse','--verify','--end-of-options',`${requestedBase}^{commit}`).trim();
    head=git('rev-parse','HEAD').trim(); mergeBase=git('merge-base',base,head).trim();
  } catch { throw new Error('BASE_REF_UNAVAILABLE: fetch the requested target branch; no empty-diff fallback is allowed'); }
  const split=s=>s.split('\0').filter(Boolean);
  const committed=split(git('diff','--no-renames','--name-only','-z',mergeBase,head,'--'));
  const dirty=split(git('diff','--no-renames','--name-only','-z','HEAD','--'));
  const untracked=split(git('ls-files','--others','--exclude-standard','-z'));
  return {base,head,mergeBase,files:[...new Set([...committed,...dirty,...untracked])].sort(),dirty:dirty.length>0||untracked.length>0};
}
export function classify(file,config) {
  if (config.highFiles.includes(file)||config.highPrefixes.some(p=>file.startsWith(p))||/\.tf$/u.test(file)) return 'HIGH';
  if (/^services\/[^/]*(?:optimizer|flex|dispatch|settlement|ledger|policy|rules|control|auth)[^/]*\//u.test(file)) return 'HIGH';
  return /^(?:apps|packages|services|integrations|scripts)\//u.test(file)?'MEDIUM':'LOW';
}
export function analyze(diff,index,config) {
  const reverse=new Map();
  const add=(to,from)=>{if(!reverse.has(to))reverse.set(to,new Set());reverse.get(to).add(from);};
  for(const edge of index.imports) if(edge.to) add(edge.to,edge.from);
  const touched=new Set(diff.files), queue=[...touched];
  while(queue.length) for(const item of reverse.get(queue.shift())??[]) if(!touched.has(item)){touched.add(item);queue.push(item);}
  const owns=(file,p)=>p.path!==''&&(file===p.path||file.startsWith(p.path+'/'));
  const packages=new Set(index.packages.filter(p=>[...touched].some(f=>owns(f,p))).map(p=>p.name));
  let added=true;
  while(added){added=false;for(const p of index.packages) if(!packages.has(p.name)&&p.localDependencies.some(d=>packages.has(d))){packages.add(p.name);added=true;}}
  const ranks={LOW:0,MEDIUM:1,HIGH:2}; let risk='LOW';const reasons=[];
  for(const file of diff.files){const value=classify(file,config);if(ranks[value]>ranks[risk])risk=value;if(value==='HIGH')reasons.push(`critical path: ${file}`);}
  if(index.coverage.unknowns.length){risk='HIGH';reasons.push('Index has unresolved/dynamic dependencies; use full verification.');}
  if(diff.files.some(f=>/^supabase\//u.test(f))){risk='HIGH';reasons.push('SQL dependencies require database replay, not import-graph inference.');}
  const requiredChecks=['application'];
  const sqlContractChange=diff.files.some(f=>/^(supabase|scripts\/database)\//u.test(f)
    || /^packages\/(domain|events|api-contracts|kernel)\//u.test(f));
  if(sqlContractChange || diff.files.includes('.github/workflows/database-verification.yml')) requiredChecks.push('database-replay-and-rls');
  if(sqlContractChange) requiredChecks.push('rpc-contract-and-concurrency-tests');
  if(diff.files.some(f=>/^supabase\/proposals\//u.test(f))) requiredChecks.push('proposal-materialization-and-postgres-tests');
  if(diff.files.some(f=>/^\.github\/workflows\//u.test(f))) requiredChecks.push('ci-workflow-security-review');
  if(diff.files.some(f=>/(^|\/)package\.json$/u.test(f) || ['pnpm-lock.yaml','pnpm-workspace.yaml'].includes(f))) requiredChecks.push('dependency-and-lock-review');
  if(diff.files.some(f=>/^integrations\//u.test(f))) requiredChecks.push('provider-contract-and-sandbox-tests');
  if(diff.files.some(f=>/^packages\/(domain|kernel|events|api-contracts)\//u.test(f))) requiredChecks.push('canonical-contract-tests');
  if(diff.files.some(f=>/^infra\//u.test(f)||/\.tf$/u.test(f))) requiredChecks.push('infra-plan-and-iam-review');
  if(diff.files.some(f=>/^apps\/[^/]+\/src\/app\//u.test(f))) requiredChecks.push('browser-e2e');
  return {...diff,risk,fullSuiteRequired:risk==='HIGH'||diff.dirty||packages.size===0,changedFiles:diff.files,impactedFiles:[...touched].sort(),impactedPackages:[...packages].sort(),requiredChecks,reasons,coverage:index.coverage};
}
