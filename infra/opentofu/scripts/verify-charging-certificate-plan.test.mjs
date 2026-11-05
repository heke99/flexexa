import test from 'node:test';
import assert from 'node:assert/strict';
import {expectedResources} from './verify-dev-plan.mjs';
import {separateCertificate,verifyCertificatePlan} from './verify-charging-certificate-plan.mjs';
const provider='registry.opentofu.org/hashicorp/aws';
function fixture(){
 const resources=[...expectedResources()].map(([address,values])=>({address,values:structuredClone(values),type:address.split('.')[2],provider_name:provider,mode:'managed'}));
 for(const r of resources)if(r.type==='aws_ecr_lifecycle_policy')r.values.policy=JSON.stringify({rules:[{rulePriority:1,selection:{tagStatus:'untagged',countType:'sinceImagePushed',countUnit:'days',countNumber:14},action:{type:'expire'}}]});
 const cert={address:'aws_acm_certificate.charging_api',type:'aws_acm_certificate',provider_name:provider,mode:'managed',values:{domain_name:'api-staging.flexexa.com',validation_method:'DNS',key_algorithm:'RSA_2048',subject_alternative_names:[],tags_all:{Project:'flexexa',Environment:'dev',ManagedBy:'opentofu'},options:[{certificate_transparency_logging_preference:'ENABLED'}]}};
 return {format_version:'1.2',complete:true,errored:false,variables:{aws_region:{value:'eu-north-1'},environment:{value:'dev'},project:{value:'flexexa'},github_repository:{value:'heke99/flexexa'}},planned_values:{outputs:{aws_account_id:{value:'938095765653'},aws_region:{value:'eu-north-1'},environment:{value:'dev'}},root_module:{resources:[cert],child_modules:[{address:'module.foundation',resources}]}},resource_changes:[...resources.map(r=>({...r,change:{actions:['no-op'],before:r.values,after:r.values,after_unknown:{}}})),{...cert,change:{actions:['create'],before:null,after:cert.values,after_unknown:{}}}]};
}
const certificate=p=>p.planned_values.root_module.resources[0].values;
test('one approved certificate with unchanged foundation passes',()=>assert.equal(verifyCertificatePlan(fixture()).certificate.action,'create'));
for(const [key,value] of [['domain_name','evil.example'],['validation_method','EMAIL'],['private_key','secret'],['subject_alternative_names',['*.flexexa.com']]])test(`reject certificate ${key}`,()=>{const p=fixture();certificate(p)[key]=value;assert.throws(()=>verifyCertificatePlan(p));});
test('foundation mutation cannot be hidden by certificate exception',()=>{const p=fixture();p.resource_changes[0].change.actions=['update'];assert.throws(()=>verifyCertificatePlan(p));});
test('certificate deletion/replacement denied',()=>{for(const actions of [['delete'],['delete','create']]){const p=fixture();p.resource_changes.at(-1).change.actions=actions;assert.throws(()=>separateCertificate(p));}});
test('extra unrelated managed resource remains rejected',()=>{const p=fixture();p.planned_values.root_module.resources.push({address:'aws_iam_user.attacker',type:'aws_iam_user',provider_name:provider,mode:'managed',values:{}});assert.throws(()=>verifyCertificatePlan(p));});
