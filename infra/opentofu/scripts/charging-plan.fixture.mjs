import {expectedResources} from './verify-dev-plan.mjs';
const provider='registry.opentofu.org/hashicorp/aws';
export function fixture(){
 const resources=[...expectedResources()].map(([address,values])=>({address,values:structuredClone(values),type:address.split('.')[2],provider_name:provider,mode:'managed'}));
 for(const r of resources)if(r.type==='aws_ecr_lifecycle_policy')r.values.policy=JSON.stringify({rules:[{rulePriority:1,selection:{tagStatus:'untagged',countType:'sinceImagePushed',countUnit:'days',countNumber:14},action:{type:'expire'}}]});
 const cert={address:'aws_acm_certificate.charging_api',type:'aws_acm_certificate',provider_name:provider,mode:'managed',values:{domain_name:'api-staging.flexexa.com',validation_method:'DNS',key_algorithm:'RSA_2048',subject_alternative_names:[],tags_all:{Project:'flexexa',Environment:'dev',ManagedBy:'opentofu'},options:[{certificate_transparency_logging_preference:'ENABLED'}]}};
 return {format_version:'1.2',complete:true,errored:false,variables:{aws_region:{value:'eu-north-1'},environment:{value:'dev'},project:{value:'flexexa'},github_repository:{value:'heke99/flexexa'}},planned_values:{outputs:{aws_account_id:{value:'938095765653'},aws_region:{value:'eu-north-1'},environment:{value:'dev'}},root_module:{resources:[cert],child_modules:[{address:'module.foundation',resources}]}},resource_changes:[...resources.map(r=>({...r,change:{actions:['no-op'],before:r.values,after:r.values,after_unknown:{}}})),{...cert,change:{actions:['create'],before:null,after:cert.values,after_unknown:{}}}]};
}
