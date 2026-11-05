import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyDevPlan} from './verify-dev-plan.mjs';
const address='aws_acm_certificate.charging_api',domain='api-staging.flexexa.com';
const deny=()=>{throw Error('CHARGING_CERTIFICATE_PLAN_REJECTED');};
export function separateCertificate(plan){
 const clean=structuredClone(plan),root=clean.planned_values?.root_module;
 if(!root||!Array.isArray(root.resources)||!Array.isArray(clean.resource_changes))deny();
 const resources=root.resources.filter(r=>r.address===address),changes=clean.resource_changes.filter(r=>r.address===address);
 if(resources.length!==1||changes.length!==1)deny();
 const resource=resources[0],change=changes[0];
 for(const r of [resource,change])if(r.mode!=='managed'||r.type!=='aws_acm_certificate'||!['registry.opentofu.org/hashicorp/aws','registry.terraform.io/hashicorp/aws'].includes(r.provider_name))deny();
 const actions=change.change?.actions;
 if(!Array.isArray(actions)||actions.length!==1||!['create','no-op'].includes(actions[0])||change.importing||change.change.importing)deny();
 for(const p of [resource.values,change.change.after]){
  if(!p||p.domain_name!==domain||p.validation_method!=='DNS'||p.key_algorithm!=='RSA_2048'||p.certificate_body||p.private_key||p.certificate_chain||p.certificate_authority_arn)deny();
  if(!Array.isArray(p.subject_alternative_names)||p.subject_alternative_names.some(x=>x!==domain))deny();
  if(p.tags_all?.Project!=='flexexa'||p.tags_all?.Environment!=='dev'||p.tags_all?.ManagedBy!=='opentofu')deny();
  if(p.options?.length!==1||p.options[0].certificate_transparency_logging_preference!=='ENABLED')deny();
 }
 root.resources=root.resources.filter(r=>r.address!==address);
 clean.resource_changes=clean.resource_changes.filter(r=>r.address!==address);
 return {foundation:clean,certificate:{address,domain,action:actions[0]}};
}
export function verifyCertificatePlan(plan){const result=separateCertificate(plan);return {foundation:verifyDevPlan(result.foundation,{requireNoop:true}),certificate:result.certificate};}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{
  const [input,output,summary]=process.argv.slice(2);if(!input||!output||!summary)deny();
  const plan=JSON.parse(readFileSync(input,'utf8')),parts=separateCertificate(plan),result=verifyCertificatePlan(plan);
  writeFileSync(output,JSON.stringify(parts.foundation),{flag:'wx',mode:0o600});writeFileSync(summary,JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(result));
 }catch{console.error('CHARGING_CERTIFICATE_PLAN_REJECTED');process.exitCode=1;}
}
