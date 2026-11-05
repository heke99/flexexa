import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyCertificatePlan,separateCertificate} from './verify-charging-certificate-plan.mjs';
const prefix='module.charging_api[0].';
export const runtimeAddresses=['aws_security_group.edge','aws_security_group.task','aws_vpc_security_group_ingress_rule.https','aws_vpc_security_group_egress_rule.edge_task','aws_vpc_security_group_ingress_rule.task_edge','aws_vpc_security_group_egress_rule.tls','aws_lb.api','aws_lb_target_group.api','aws_lb_listener.https','aws_iam_role.execution','aws_iam_role.task','aws_iam_role_policy.execution','aws_ecs_task_definition.api','aws_ecs_service.api','aws_eip.egress','aws_nat_gateway.egress','aws_route.egress["0"]','aws_route.egress["1"]'];
const reject=reason=>{throw Error('CHARGING_RUNTIME_PLAN_REJECTED: '+reason);};
export function verifyRuntimePlan(plan,{reviewTaintedTask=false}={}){
 const clean=structuredClone(plan),root=clean.planned_values?.root_module;
 const modules=root?.child_modules?.filter(m=>m.address==='module.charging_api[0]');
 if(modules?.length!==1)reject('runtime module');
 const rows=modules[0].resources,changes=clean.resource_changes?.filter(r=>r.address.startsWith(prefix));
 if(rows?.length!==runtimeAddresses.length||changes?.length!==runtimeAddresses.length)reject('runtime count');
 for(const list of [rows,changes]){
  const seen=new Set();
  for(const r of list){const name=r.address.slice(prefix.length);if(!runtimeAddresses.includes(name)||seen.has(name)||r.mode!=='managed'||r.type!==name.split('.')[0]||!['registry.opentofu.org/hashicorp/aws','registry.terraform.io/hashicorp/aws'].includes(r.provider_name))reject('resource identity');seen.add(name);}
 }
 for(const r of changes){const action=r.change?.actions?.join(',');const reviewedTaint=reviewTaintedTask&&r.address===prefix+'aws_ecs_task_definition.api'&&action==='delete,create'&&r.action_reason==='replace_because_tainted'&&r.change.before?.arn==='arn:aws:ecs:eu-north-1:938095765653:task-definition/flexexa-dev-charging-api:1';if((!['create','no-op'].includes(action)&&!reviewedTaint)||r.change.importing||r.previous_address)reject('only creates or unchanged resources allowed');if(action==='create'&&r.change.before!==null)reject('create with existing resource');if(action==='no-op'&&JSON.stringify(r.change.before)!==JSON.stringify(r.change.after))reject('no-op values differ');}
 for(const rowsToCheck of [rows,changes.map(r=>({...r,values:r.change.after}))]){
  const values=name=>rowsToCheck.find(r=>r.address===prefix+name)?.values;
  for(const name of ['execution','task']){const v=values('aws_iam_role.'+name);if(v.name!=='flexexa-dev-charging-api-'+name||v.permissions_boundary!=='arn:aws:iam::938095765653:policy/FlexexaChargingTaskBoundaryDev')reject('bounded roles');const trust=JSON.parse(v.assume_role_policy);if(trust.Statement?.length!==1||trust.Statement[0].Principal?.Service!=='ecs-tasks.amazonaws.com'||trust.Statement[0].Action!=='sts:AssumeRole')reject('role trust');}
  const td=values('aws_ecs_task_definition.api');if(td.family!=='flexexa-dev-charging-api'||td.cpu!=='256'||td.memory!=='512'||td.network_mode!=='awsvpc'||td.requires_compatibilities?.join(',')!=='FARGATE')reject('task limits');
  const containers=JSON.parse(td.container_definitions);if(containers.length!==1)reject('containers');const c=containers[0];if(c.name!=='api'||c.user!=='65532:65532'||c.readonlyRootFilesystem!==true||c.linuxParameters?.capabilities?.drop?.join(',')!=='ALL'||!/^938095765653\.dkr\.ecr\.eu-north-1\.amazonaws\.com\/flexexa\/dev\/api@sha256:[a-f0-9]{64}$/.test(c.image))reject('container security');
  const env=Object.fromEntries((c.environment??[]).map(e=>[e.name,e.value]));if(Object.keys(env).length!==3||env.SUPABASE_URL!=='https://zhgwlvmtvwjftyjmgljw.supabase.co'||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.SUPABASE_PUBLISHABLE_KEY)||env.PORT!=='8080'||c.secrets?.length||c.privileged)reject('public config only');
  const service=values('aws_ecs_service.api');if(service.name!=='flexexa-dev-charging-api'||service.desired_count!==1||service.launch_type!=='FARGATE'||service.network_configuration?.[0]?.assign_public_ip!==false||service.deployment_circuit_breaker?.[0]?.rollback!==true)reject('service isolation');
  const listener=values('aws_lb_listener.https');if(listener.port!==443||listener.protocol!=='HTTPS'||listener.certificate_arn!=='arn:aws:acm:eu-north-1:938095765653:certificate/4bba5691-0345-4941-bb65-14572415bce9')reject('issued HTTPS certificate');
  for(const n of ['https','task_edge','edge_task','tls']){const ingress=['https','task_edge'].includes(n),v=values('aws_vpc_security_group_'+(ingress?'ingress':'egress')+'_rule.'+n),port=['https','tls'].includes(n)?443:8080;if(v.from_port!==port||v.to_port!==port||v.ip_protocol!=='tcp'||(port===8080&&v.cidr_ipv4))reject('network ports');}
 }
 const runtimeDrift=(clean.resource_drift??[]).filter(r=>r.address.startsWith(prefix));
 for(const r of runtimeDrift){
  const before=r.change?.before,after=r.change?.after;
  if(!runtimeAddresses.includes(r.address.slice(prefix.length))||r.change.actions?.join(',')!=='update'||!before||!after||before.id!==after.id)reject('runtime drift identity');
  const tags=p=>({...p.tags_all,...p.tags});const b=tags(before),a=tags(after);
  if(Object.keys(b).length!==3||Object.keys(a).length!==3||!Object.entries({Project:'flexexa',Environment:'dev',ManagedBy:'opentofu'}).every(([k,v])=>a[k]===v&&b[k]===v))reject('runtime tag projection');
  for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(!['tags','tags_all'].includes(key)&&JSON.stringify(before[key])!==JSON.stringify(after[key]))reject('runtime drift field');
 }
 if(clean.resource_drift)clean.resource_drift=clean.resource_drift.filter(r=>!r.address.startsWith(prefix));
 root.child_modules=root.child_modules.filter(m=>m.address!=='module.charging_api[0]');
 clean.resource_changes=clean.resource_changes.filter(r=>!r.address.startsWith(prefix));
 return {review_only_tainted_task:changes.some(r=>r.change.actions.join(',')==='delete,create'),runtime_resources:runtimeAddresses.length,runtime_creates:changes.filter(r=>r.change.actions[0]==='create').length,runtime_noop:changes.filter(r=>r.change.actions[0]==='no-op').length,foundation:verifyCertificatePlan(clean)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const plan=JSON.parse(readFileSync(process.argv[2],'utf8')),result=verifyRuntimePlan(plan,{reviewTaintedTask:process.argv.includes('--review-tainted-task')});
 if(process.argv[4]){const clean=structuredClone(plan);clean.planned_values.root_module.child_modules=clean.planned_values.root_module.child_modules.filter(m=>m.address!=='module.charging_api[0]');clean.resource_changes=clean.resource_changes.filter(r=>!r.address.startsWith(prefix));if(clean.resource_drift)clean.resource_drift=clean.resource_drift.filter(r=>!r.address.startsWith(prefix));writeFileSync(process.argv[4],JSON.stringify(separateCertificate(clean).foundation),{flag:'wx',mode:0o600});}if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}}
