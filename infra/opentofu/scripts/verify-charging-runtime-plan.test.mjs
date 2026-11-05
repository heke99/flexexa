import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture as foundation} from './charging-plan.fixture.mjs';
import {runtimeAddresses,verifyRuntimePlan,normalizeContainerReadback} from './verify-charging-runtime-plan.mjs';
function fixture(){
 const plan=foundation(),prefix='module.charging_api[0].',provider_name='registry.opentofu.org/hashicorp/aws';
 const role=name=>({name:'flexexa-dev-charging-api-'+name,permissions_boundary:'arn:aws:iam::938095765653:policy/FlexexaChargingTaskBoundaryDev',assume_role_policy:JSON.stringify({Statement:[{Principal:{Service:'ecs-tasks.amazonaws.com'},Action:'sts:AssumeRole'}]})});
 const values={
 'aws_iam_role.execution':role('execution'),'aws_iam_role.task':role('task'),
 'aws_ecs_task_definition.api':{family:'flexexa-dev-charging-api',cpu:'256',memory:'512',network_mode:'awsvpc',requires_compatibilities:['FARGATE'],container_definitions:JSON.stringify([{name:'api',user:'65532:65532',readonlyRootFilesystem:true,linuxParameters:{capabilities:{drop:['ALL']}},image:'938095765653.dkr.ecr.eu-north-1.amazonaws.com/flexexa/dev/api@sha256:'+'a'.repeat(64),environment:[{name:'SUPABASE_URL',value:'https://zhgwlvmtvwjftyjmgljw.supabase.co'},{name:'SUPABASE_PUBLISHABLE_KEY',value:'sb_publishable_fixture'},{name:'PORT',value:'8080'}]}])},
 'aws_ecs_service.api':{name:'flexexa-dev-charging-api',desired_count:1,launch_type:'FARGATE',network_configuration:[{assign_public_ip:false}],deployment_circuit_breaker:[{rollback:true}]},
 'aws_lb_listener.https':{port:443,protocol:'HTTPS',certificate_arn:'arn:aws:acm:eu-north-1:938095765653:certificate/4bba5691-0345-4941-bb65-14572415bce9'}
 };
 for(const [kind,name,port] of [['ingress','https',443],['ingress','task_edge',8080],['egress','edge_task',8080],['egress','tls',443]])values['aws_vpc_security_group_'+kind+'_rule.'+name]={from_port:port,to_port:port,ip_protocol:'tcp'};
 const resources=runtimeAddresses.map(name=>({address:prefix+name,mode:'managed',type:name.split('.')[0],provider_name,values:values[name]??{}}));
 plan.planned_values.root_module.child_modules.push({address:'module.charging_api[0]',resources});
 plan.resource_changes.push(...resources.map(r=>({...r,change:{actions:['create'],before:null,after:structuredClone(r.values)}})));
 return plan;
}
const runtime=p=>p.planned_values.root_module.child_modules.at(-1).resources;
test('exact isolated initial runtime accepted',()=>assert.equal(verifyRuntimePlan(fixture()).runtime_creates,18));
test('extra or missing runtime resource rejected',()=>{const p=fixture();runtime(p).pop();assert.throws(()=>verifyRuntimePlan(p));});
test('replacement and update rejected',()=>{for(const actions of [['update'],['delete','create']]){const p=fixture();p.resource_changes.at(-1).change.actions=actions;assert.throws(()=>verifyRuntimePlan(p));}});
test('unbounded IAM role rejected',()=>{const p=fixture();runtime(p).find(r=>r.type==='aws_iam_role').values.permissions_boundary='other';assert.throws(()=>verifyRuntimePlan(p));});
test('root, mutable image, writeable root or service key rejected',()=>{for(const mutation of [c=>c.user='0',c=>c.image='node:latest',c=>c.readonlyRootFilesystem=false,c=>c.environment[1].value='service-role']){const p=fixture(),td=runtime(p).find(r=>r.type==='aws_ecs_task_definition').values,c=JSON.parse(td.container_definitions);mutation(c[0]);td.container_definitions=JSON.stringify(c);assert.throws(()=>verifyRuntimePlan(p));}});
test('unsafe change-after cannot hide behind safe planned values',()=>{const p=fixture();p.resource_changes.find(r=>r.type==='aws_ecs_service').change.after.network_configuration[0].assign_public_ip=true;assert.throws(()=>verifyRuntimePlan(p));});
test('foundation edits remain rejected',()=>{const p=fixture();p.resource_changes[0].change.actions=['update'];assert.throws(()=>verifyRuntimePlan(p));});

test('partial verified create recovery and later no-op plan are accepted',()=>{const p=fixture();for(const r of p.resource_changes.filter(r=>r.address.startsWith('module.charging_api'))){r.change.actions=['no-op'];r.change.before=structuredClone(r.change.after);}assert.equal(verifyRuntimePlan(p).runtime_noop,18);p.resource_changes.at(-1).change.actions=['create'];p.resource_changes.at(-1).change.before=null;assert.equal(verifyRuntimePlan(p).runtime_creates,1);});

test('tainted task is reviewable only in explicit read-only review mode',()=>{const p=fixture(),r=p.resource_changes.find(r=>r.type==='aws_ecs_task_definition');r.change.actions=['delete','create'];r.action_reason='replace_because_tainted';r.change.before={...r.change.after,arn:'arn:aws:ecs:eu-north-1:938095765653:task-definition/flexexa-dev-charging-api:1'};assert.throws(()=>verifyRuntimePlan(p));assert.equal(verifyRuntimePlan(p,{reviewTaintedTask:true}).runtime_resources,18);r.action_reason='replace_because_cannot_update';assert.throws(()=>verifyRuntimePlan(p,{reviewTaintedTask:true}));});

test('only harmless ECS default arrays and same host port normalize',()=>{const a=[{portMappings:[{containerPort:8080}],linuxParameters:{capabilities:{drop:['ALL']}}}],b=structuredClone(a);b[0].portMappings[0].hostPort=8080;b[0].mountPoints=[];b[0].systemControls=[];b[0].volumesFrom=[];b[0].linuxParameters.capabilities.add=[];assert.equal(normalizeContainerReadback(JSON.stringify(a)),normalizeContainerReadback(JSON.stringify(b)));b[0].portMappings[0].hostPort=9000;assert.notEqual(normalizeContainerReadback(JSON.stringify(a)),normalizeContainerReadback(JSON.stringify(b)));});

test('execution role computed inline view must match the separately managed policy exactly',()=>{const p=fixture(),rows=runtime(p),policy={name:'owned-policy',policy:JSON.stringify({Statement:[{Action:'logs:PutLogEvents'}]})};Object.assign(rows.find(r=>r.type==='aws_iam_role_policy').values,policy);const tags_all={Project:'flexexa',Environment:'dev',ManagedBy:'opentofu'};p.resource_drift=[{address:'module.charging_api[0].aws_iam_role.execution',type:'aws_iam_role',change:{actions:['update'],before:{id:'execution',tags_all,inline_policy:[]},after:{id:'execution',tags_all,inline_policy:[policy]}}}];assert.equal(verifyRuntimePlan(p).runtime_resources,18);p.resource_drift[0].change.after.inline_policy=[{...policy,policy:'{}'}];assert.throws(()=>verifyRuntimePlan(p));});

test('EIP association readback must point only at its managed NAT interface',()=>{const p=fixture(),rows=runtime(p),tags_all={Project:'flexexa',Environment:'dev',ManagedBy:'opentofu'},nat={allocation_id:'eipalloc-0cbdaaab41d1ac508',network_interface_id:'eni-reviewed',private_ip:'10.40.0.10'};Object.assign(rows.find(r=>r.type==='aws_nat_gateway').values,nat);p.resource_drift=[{address:'module.charging_api[0].aws_eip.egress',type:'aws_eip',change:{actions:['update'],before:{id:nat.allocation_id,tags_all,association_id:'',network_interface:'',network_interface_owner_id:'',private_ip:''},after:{id:nat.allocation_id,tags_all,association_id:'eipassoc-037319886320a1af2',network_interface:nat.network_interface_id,network_interface_owner_id:'938095765653',private_ip:nat.private_ip}}}];assert.equal(verifyRuntimePlan(p).runtime_resources,18);p.resource_drift[0].change.after.network_interface='eni-other';assert.throws(()=>verifyRuntimePlan(p));});
