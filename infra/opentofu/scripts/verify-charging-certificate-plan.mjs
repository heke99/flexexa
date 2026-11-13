import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyDevPlan} from './verify-dev-plan.mjs';
const address='aws_acm_certificate.charging_api',domain='api-staging.flexexa.com';
const deny=(reason='shape')=>{throw Error('CHARGING_CERTIFICATE_PLAN_REJECTED: '+reason);};
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
  if(!p||p.domain_name!==domain||p.validation_method!=='DNS'||p.key_algorithm!=='RSA_2048'||p.private_key||p.certificate_authority_arn)deny('certificate parameters');
  if((p.certificate_body||p.certificate_chain)&&!(actions[0]==='no-op'&&p.arn==='arn:aws:acm:eu-north-1:938095765653:certificate/4bba5691-0345-4941-bb65-14572415bce9'&&JSON.stringify(change.change.before)===JSON.stringify(change.change.after)))deny('certificate PEM change');
  if(!Array.isArray(p.subject_alternative_names)||p.subject_alternative_names.some(x=>x!==domain))deny();
  if(p.tags_all?.Project!=='flexexa'||p.tags_all?.Environment!=='dev'||p.tags_all?.ManagedBy!=='opentofu')deny();
  if(p.options?.length!==1||p.options[0].certificate_transparency_logging_preference!=='ENABLED')deny();
 }
 const computed=new Set(['status','certificate_body','certificate_chain','not_before','not_after','renewal_eligibility','renewal_summary','validation_emails','domain_validation_options']);
 for(const drift of clean.resource_drift??[]){
  if(drift.address!==address)continue;
  if(drift.type!=='aws_acm_certificate'||drift.mode!=='managed'||drift.change?.actions?.join(',')!=='update')deny('certificate drift action');
  const before=drift.change.before,after=drift.change.after;
  if(before?.arn!=='arn:aws:acm:eu-north-1:938095765653:certificate/4bba5691-0345-4941-bb65-14572415bce9'||after?.arn!==before.arn)deny('certificate drift identity');
  const expectedTags={Project:'flexexa',Environment:'dev',ManagedBy:'opentofu'};
  const validTags=p=>{const tags={...(p.tags_all??{}),...(p.tags??{})};return Object.keys(tags).length===3&&Object.entries(expectedTags).every(([k,v])=>tags[k]===v);};
  for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(JSON.stringify(before[key])!==JSON.stringify(after[key])&&!computed.has(key)){
   if(['tags','tags_all'].includes(key)&&validTags(before)&&validTags(after))continue;
   deny('certificate configuration drift: '+key);
  }
 }
 if(clean.resource_drift)clean.resource_drift=clean.resource_drift.filter(r=>r.address!==address);
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
 }catch(error){console.error(error.message);process.exitCode=1;}
}
