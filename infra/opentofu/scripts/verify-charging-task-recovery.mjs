import {readFileSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const arn='arn:aws:ecs:eu-north-1:938095765653:task-definition/flexexa-dev-charging-api:1';
const image='938095765653.dkr.ecr.eu-north-1.amazonaws.com/flexexa/dev/api@sha256:6941d34a9437f9b44c86d5c6d3f867717d7d0c6f3cf3ed041fa5313d4584bccd';
const fail=()=>{throw Error('CHARGING_TASK_RECOVERY_REJECTED');};
export function verifyRecovery(live,state){
 const td=live.taskDefinition;if(td?.taskDefinitionArn!==arn||td.status!=='ACTIVE'||td.family!=='flexexa-dev-charging-api'||td.cpu!=='256'||td.memory!=='512'||td.networkMode!=='awsvpc'||td.requiresCompatibilities?.join(',')!=='FARGATE')fail();
 for(const [key,name] of [['executionRoleArn','execution'],['taskRoleArn','task']])if(td[key]!=='arn:aws:iam::938095765653:role/flexexa-dev-charging-api-'+name)fail();
 const containers=td.containerDefinitions;if(containers?.length!==1)fail();const c=containers[0];
 if(c.name!=='api'||c.image!==image||c.user!=='65532:65532'||c.readonlyRootFilesystem!==true||c.linuxParameters?.capabilities?.drop?.join(',')!=='ALL'||c.privileged||c.secrets?.length)fail();
 const env=Object.fromEntries((c.environment??[]).map(v=>[v.name,v.value]));if(Object.keys(env).length!==3||env.SUPABASE_URL!=='https://zhgwlvmtvwjftyjmgljw.supabase.co'||env.SUPABASE_PUBLISHABLE_KEY!=='sb_publishable_zuLquTyvDL7e_aYZnBKw4w_wrUIl84U'||env.PORT!=='8080')fail();
 const tags=Object.fromEntries((live.tags??[]).map(t=>[t.key,t.value]));if(tags.Project!=='flexexa'||tags.Environment!=='dev'||tags.ManagedBy!=='opentofu')fail();
 const rows=state.resources?.filter(r=>r.module==='module.charging_api[0]'&&r.type==='aws_ecs_task_definition'&&r.name==='api');if(rows?.length!==1||rows[0].instances?.length!==1)fail();
 const instance=rows[0].instances[0];if(instance.attributes?.arn!==arn||instance.attributes.family!=='flexexa-dev-charging-api')fail();
 const stored=JSON.parse(instance.attributes.container_definitions);if(stored?.length!==1||stored[0].image!==image||stored[0].user!=='65532:65532'||stored[0].readonlyRootFilesystem!==true)fail();
 if(instance.status!==undefined&&instance.status!=='tainted')fail();return {untaint:instance.status==='tainted',arn,scope:'existing verified task metadata only; no resource changes'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const r=verifyRecovery(JSON.parse(readFileSync(process.argv[2],'utf8')),JSON.parse(readFileSync(process.argv[3],'utf8')));if(!process.env.GITHUB_OUTPUT)fail();appendFileSync(process.env.GITHUB_OUTPUT,'untaint='+r.untaint+'\n');console.log(JSON.stringify(r));}catch{console.error('CHARGING_TASK_RECOVERY_REJECTED');process.exitCode=1;}}
