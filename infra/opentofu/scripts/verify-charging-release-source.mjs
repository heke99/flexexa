import {appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const sourceSha='6c39394b78de49b0b987c6ed4550f2f15f6a303b';
const workflows=new Set(['Flexexa quality verification','Supabase replay and authorization tests','OpenTofu AWS plan']);
const reject=()=>{throw Error('CHARGING_RELEASE_CONTEXT_REJECTED');};
export function validateReleaseContext(env,branch,runs){
 for(const [key,value] of Object.entries({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/main',GITHUB_REPOSITORY:'heke99/flexexa',GITHUB_REPOSITORY_ID:'1362385793',GITHUB_REPOSITORY_OWNER_ID:'129280077'}))if(env[key]!==value)reject();
 if(!/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')||branch.protected!==true||branch.commit?.sha!==env.GITHUB_SHA)reject();
 for(const name of workflows)if(!runs.some(r=>r.name===name&&r.head_sha===sourceSha&&r.event==='pull_request'&&r.status==='completed'&&r.conclusion==='success'&&r.head_repository?.id===1362385793&&r.repository?.id===1362385793))reject();
 return {source_sha:sourceSha,main_sha:env.GITHUB_SHA,scope:'development certificate only; unchanged foundation'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const token=process.env.GITHUB_TOKEN;if(!token)reject();
  const request=async path=>{const r=await fetch('https://api.github.com/repos/heke99/flexexa/'+path,{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)reject();return r.json();};
  const [branch,runs]=await Promise.all([request('branches/main'),request('actions/runs?event=pull_request&head_sha='+sourceSha+'&per_page=100')]);
  const result=validateReleaseContext(process.env,branch,runs.workflow_runs??[]);
  if(!process.env.GITHUB_OUTPUT)reject();appendFileSync(process.env.GITHUB_OUTPUT,'source_sha='+sourceSha+'\n');console.log(JSON.stringify(result));
 }catch{console.error('CHARGING_RELEASE_CONTEXT_REJECTED');process.exitCode=1;}
}
