import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {verifyCertificatePlan,separateCertificate} from './verify-charging-certificate-plan.mjs';
const prefix='module.charging_api[0].';
const natTableAddresses=['eu-north-1a','eu-north-1b'].map(z=>'module.foundation.aws_route_table.private[\"'+z+'\"]');
export const runtimeAddresses=['aws_security_group.edge','aws_security_group.task','aws_vpc_security_group_ingress_rule.https','aws_vpc_security_group_egress_rule.edge_task','aws_vpc_security_group_ingress_rule.task_edge','aws_vpc_security_group_egress_rule.tls','aws_lb.api','aws_lb_target_group.api','aws_lb_listener.https','aws_iam_role.execution','aws_iam_role.task','aws_iam_role_policy.execution','aws_ecs_task_definition.api','aws_ecs_service.api','aws_eip.egress','aws_nat_gateway.egress','aws_route.egress["0"]','aws_route.egress["1"]'];
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export function normalizeContainerReadback(value){const containers=JSON.parse(value);for(const c of containers){for(const key of ['mountPoints','systemControls','volumesFrom'])if(Array.isArray(c[key])&&c[key].length===0)delete c[key];if(c.linuxParameters?.capabilities?.add?.length===0)delete c.linuxParameters.capabilities.add;for(const port of c.portMappings??[])if(port.hostPort===port.containerPort)delete port.hostPort;}return JSON.stringify(canonical(containers));}
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
  for(const key of new Set([...Object.keys(before),...Object.keys(after)]))if(!['tags','tags_all'].includes(key)&&JSON.stringify(canonical(before[key]))!==JSON.stringify(canonical(after[key]))){
   if(r.address===prefix+'aws_ecs_task_definition.api'&&before.arn==='arn:aws:ecs:eu-north-1:938095765653:task-definition/flexexa-dev-charging-api:1'){
    if(key==='arn_without_revision'&&after[key]==='arn:aws:ecs:eu-north-1:938095765653:task-definition/flexexa-dev-charging-api'&&(before[key]==null||before[key]===after[key]))continue;
    if(key==='revision'&&after[key]===1&&(before[key]==null||before[key]===0))continue;
    if(key==='enable_fault_injection'&&after[key]===false&&before[key]==null)continue;
    if(['ipc_mode','pid_mode'].includes(key)&&before[key]==null&&after[key]==='')continue;
    if(['placement_constraints','inference_accelerator','volume','proxy_configuration','ephemeral_storage','runtime_platform'].includes(key)&&before[key]==null&&Array.isArray(after[key])&&after[key].length===0)continue;
    if(key==='container_definitions'&&normalizeContainerReadback(before[key])===normalizeContainerReadback(after[key]))continue;
   }
   if(r.address===prefix+'aws_lb_target_group.api'&&key==='load_balancer_arns'&&Array.isArray(before[key])&&before[key].length===0){
    const lb=rows.find(row=>row.address===prefix+'aws_lb.api').values,listener=rows.find(row=>row.address===prefix+'aws_lb_listener.https').values,owner=changes.find(row=>row.address===prefix+'aws_lb_listener.https');
    if(JSON.stringify(after.load_balancer_arns)===JSON.stringify([lb.arn])&&listener.load_balancer_arn===lb.arn&&listener.default_action?.length===1&&listener.default_action[0].type==='forward'&&listener.default_action[0].target_group_arn===after.arn&&owner.change.actions.join(',')==='no-op')continue;
   }
   if(['aws_security_group.edge','aws_security_group.task'].map(n=>prefix+n).includes(r.address)&&['ingress','egress'].includes(key)&&(before[key]==null||before[key].length===0)){
    const edge=r.address.endsWith('.edge'),incoming=key==='ingress',publicRule=edge===incoming,peer=rows.find(row=>row.address===prefix+'aws_security_group.'+(edge?'task':'edge')).values;
    const ownerName=publicRule?(edge?'aws_vpc_security_group_ingress_rule.https':'aws_vpc_security_group_egress_rule.tls'):(edge?'aws_vpc_security_group_egress_rule.edge_task':'aws_vpc_security_group_ingress_rule.task_edge');
    const owner=rows.find(row=>row.address===prefix+ownerName).values,ownerChange=changes.find(row=>row.address===prefix+ownerName);
    const rule=after[key]?.[0],port=publicRule?443:8080;
    // CloudFormation flexexa-energy-sandbox/EdgeToEnergy owns the additional peer.
    // Reviewed AWS read-back: sgr-0e251aad7ed953792, same VPC; no CIDR or port expansion.
    const peerSets=publicRule?[[]]:[[peer.id]];
    if(edge&&!incoming&&after.id==='sg-0b3062b2e7a019572'&&peer.id==='sg-00ed64209d55b98ea'&&after.vpc_id==='vpc-0e6b5f83999698112'&&peer.vpc_id===after.vpc_id&&changes.find(row=>row.address===r.address).change.actions.join(',')==='no-op')peerSets.push([peer.id,'sg-08817d86ba10859c6']);
    const matchesPeers=Array.isArray(rule?.security_groups)&&peerSets.some(ids=>JSON.stringify([...rule.security_groups].sort())===JSON.stringify([...ids].sort()));
    const fields=['cidr_blocks','description','from_port','ipv6_cidr_blocks','prefix_list_ids','protocol','security_groups','self','to_port'];
    if(after[key]?.length===1&&rule&&Object.keys(rule).every(k=>fields.includes(k))&&rule.from_port===port&&rule.to_port===port&&rule.protocol==='tcp'&&rule.self===false&&(rule.description===''||rule.description==null)&&rule.ipv6_cidr_blocks?.length===0&&rule.prefix_list_ids?.length===0&&JSON.stringify(rule.cidr_blocks)===(publicRule?'["0.0.0.0/0"]':'[]')&&matchesPeers&&owner.security_group_id===after.id&&owner.from_port===port&&owner.to_port===port&&owner.ip_protocol==='tcp'&&(publicRule?owner.cidr_ipv4==='0.0.0.0/0':owner.referenced_security_group_id===peer.id)&&ownerChange.change.actions.join(',')==='no-op')continue;
   }
   if(r.address===prefix+'aws_eip.egress'&&['association_id','network_interface','network_interface_owner_id','private_ip','private_dns'].includes(key)&&(before[key]==null||before[key]==='')){
    const nat=rows.find(row=>row.address===prefix+'aws_nat_gateway.egress').values;
    if(after.id==='eipalloc-0cbdaaab41d1ac508'&&nat.allocation_id===after.id&&after.network_interface===nat.network_interface_id&&after.private_ip===nat.private_ip&&(after.network_interface_owner_id==null||after.network_interface_owner_id==='938095765653')&&after.association_id==='eipassoc-037319886320a1af2'&&(key!=='private_dns'||after.private_dns==='ip-'+nat.private_ip.replaceAll('.','-')+'.eu-north-1.compute.internal'))continue;
   }
   if(r.address===prefix+'aws_iam_role.execution'&&key==='inline_policy'){
    const policy=rows.find(row=>row.address===prefix+'aws_iam_role_policy.execution').values;
    const matches=list=>Array.isArray(list)&&list.length===1&&list[0].name===policy.name&&JSON.stringify(canonical(JSON.parse(list[0].policy)))===JSON.stringify(canonical(JSON.parse(policy.policy)));
    if((before.inline_policy==null||before.inline_policy.length===0||matches(before.inline_policy))&&matches(after.inline_policy))continue;
   }
   reject('runtime drift field: '+r.type+':'+key);
  }
 }
 if(clean.resource_drift)clean.resource_drift=clean.resource_drift.filter(r=>!r.address.startsWith(prefix));
 for(const drift of clean.resource_drift??[]){
  if(!natTableAddresses.includes(drift.address))continue;
  const before=drift.change?.before,after=drift.change?.after,nat=rows.find(r=>r.address===prefix+'aws_nat_gateway.egress').values;
  const route=rows.find(r=>r.type==='aws_route'&&r.values.route_table_id===after?.id)?.values;
  const withoutRoute=p=>Object.fromEntries(Object.entries(p).filter(([k])=>k!=='route'));
  if(drift.type!=='aws_route_table'||drift.mode!=='managed'||drift.change.actions?.join(',')!=='update'||!before||!after||before.id!==after.id||after.region!=='eu-north-1'||!Array.isArray(before.route)||before.route.length!==0||after.route?.length!==1||JSON.stringify(canonical(withoutRoute(before)))!==JSON.stringify(canonical(withoutRoute(after)))||!route||route.nat_gateway_id!==nat.id||route.destination_cidr_block!=='0.0.0.0/0'||route.state!=='active'||route.origin!=='CreateRoute')reject('private route owner projection');
  const value=after.route[0],fields=new Set(['cidr_block','gateway_id','ipv6_cidr_block','destination_prefix_list_id','carrier_gateway_id','core_network_arn','egress_only_gateway_id','local_gateway_id','nat_gateway_id','network_interface_id','odb_network_arn','transit_gateway_id','vpc_endpoint_id','vpc_peering_connection_id']);
  if(value.cidr_block!=='0.0.0.0/0'||value.nat_gateway_id!==nat.id||Object.entries(value).some(([k,v])=>!fields.has(k)||(!['cidr_block','nat_gateway_id'].includes(k)&&v!==''&&v!==null)))reject('private route projection fields');
 }
 if(clean.resource_drift)clean.resource_drift=clean.resource_drift.filter(r=>!natTableAddresses.includes(r.address));
 root.child_modules=root.child_modules.filter(m=>m.address!=='module.charging_api[0]');
 clean.resource_changes=clean.resource_changes.filter(r=>!r.address.startsWith(prefix));
 return {review_only_tainted_task:changes.some(r=>r.change.actions.join(',')==='delete,create'),runtime_resources:runtimeAddresses.length,runtime_creates:changes.filter(r=>r.change.actions[0]==='create').length,runtime_noop:changes.filter(r=>r.change.actions[0]==='no-op').length,foundation:verifyCertificatePlan(clean)};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{const plan=JSON.parse(readFileSync(process.argv[2],'utf8')),result=verifyRuntimePlan(plan,{reviewTaintedTask:process.argv.includes('--review-tainted-task')});
 if(process.argv[4]){const clean=structuredClone(plan);clean.planned_values.root_module.child_modules=clean.planned_values.root_module.child_modules.filter(m=>m.address!=='module.charging_api[0]');clean.resource_changes=clean.resource_changes.filter(r=>!r.address.startsWith(prefix));if(clean.resource_drift)clean.resource_drift=clean.resource_drift.filter(r=>!r.address.startsWith(prefix)&&!natTableAddresses.includes(r.address));writeFileSync(process.argv[4],JSON.stringify(separateCertificate(clean).foundation),{flag:'wx',mode:0o600});}if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(result,null,2),{flag:'wx',mode:0o600});console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}}
