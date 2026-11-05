import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRecovery} from './verify-charging-task-recovery.mjs';
function fixture(){
 const arn='arn:aws:ecs:eu-north-1:938095765653:task-definition/flexexa-dev-charging-api:1';
 const c={name:'api',image:'938095765653.dkr.ecr.eu-north-1.amazonaws.com/flexexa/dev/api@sha256:6941d34a9437f9b44c86d5c6d3f867717d7d0c6f3cf3ed041fa5313d4584bccd',user:'65532:65532',readonlyRootFilesystem:true,linuxParameters:{capabilities:{drop:['ALL']}},environment:[{name:'SUPABASE_URL',value:'https://zhgwlvmtvwjftyjmgljw.supabase.co'},{name:'SUPABASE_PUBLISHABLE_KEY',value:'sb_publishable_zuLquTyvDL7e_aYZnBKw4w_wrUIl84U'},{name:'PORT',value:'8080'}]};
 return [{taskDefinition:{taskDefinitionArn:arn,status:'ACTIVE',family:'flexexa-dev-charging-api',cpu:'256',memory:'512',networkMode:'awsvpc',requiresCompatibilities:['FARGATE'],executionRoleArn:'arn:aws:iam::938095765653:role/flexexa-dev-charging-api-execution',taskRoleArn:'arn:aws:iam::938095765653:role/flexexa-dev-charging-api-task',containerDefinitions:[c]},tags:[{key:'Project',value:'flexexa'},{key:'Environment',value:'dev'},{key:'ManagedBy',value:'opentofu'}]},{resources:[{module:'module.charging_api[0]',type:'aws_ecs_task_definition',name:'api',instances:[{status:'tainted',attributes:{arn,family:'flexexa-dev-charging-api',container_definitions:JSON.stringify([c])}}]}]}];
}
test('verified existing active task can have only taint metadata restored',()=>assert.equal(verifyRecovery(...fixture()).untaint,true));
test('healthy matching state needs no mutation',()=>{const [l,s]=fixture();delete s.resources[0].instances[0].status;assert.equal(verifyRecovery(l,s).untaint,false);});
test('different revision, image or unsafe task cannot be recovered',()=>{for(const mutate of [l=>l.taskDefinition.taskDefinitionArn+='2',l=>l.taskDefinition.containerDefinitions[0].image='node:latest',l=>l.taskDefinition.containerDefinitions[0].user='0',l=>l.taskDefinition.executionRoleArn='other']){const [l,s]=fixture();mutate(l);assert.throws(()=>verifyRecovery(l,s));}});
test('foreign state binding is rejected',()=>{const [l,s]=fixture();s.resources[0].instances[0].attributes.arn='other';assert.throws(()=>verifyRecovery(l,s));});
