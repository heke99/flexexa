-- Transactional policy inbox. No arbitrary handler, SQL or external side effect.
insert into public.permissions(permission_key,description,domain,action,scope_type,risk_level)
 values('events.consume','Consume explicitly scoped canonical tenant events','events','consume','tenant','high');

create function private.flexexa_assert_event_worker(p_tenant_id uuid,p_environment text,p_permission text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); session uuid; at timestamptz;
 u auth.users%rowtype; s auth.sessions%rowtype; b private.flexexa_machine_principals%rowtype;
 t public.tenants%rowtype; o public.organizations%rowtype; service public.service_identities%rowtype;
 permission public.permissions%rowtype; g public.service_identity_tenant_grants%rowtype;
begin
 if actor is null or claims->>'role' is distinct from 'authenticated'
  or coalesce(claims->>'is_anonymous','false')<>'false'
  or p_environment is null or p_environment not in ('sandbox','production')
  or p_permission is null or p_permission not in ('events.publish','events.consume') then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 begin session:=private.flexexa_input_uuid(claims,'session_id');
 exception when others then raise exception using errcode='42501',message='PERMISSION_DENIED'; end;
 select * into u from auth.users where id=actor for share;
 select * into s from auth.sessions where id=session and user_id=actor for share;
 select * into b from private.flexexa_machine_principals where auth_user_id=actor for share;
 select * into t from public.tenants where id=p_tenant_id for share;
 select * into o from public.organizations where id=t.organization_id for share;
 select * into service from public.service_identities where id=b.service_identity_id for share;
 select * into permission from public.permissions where permission_key=p_permission for share;
 select * into g from public.service_identity_tenant_grants where service_identity_id=service.id
  and tenant_id=p_tenant_id and permission_id=permission.id for share;
 at:=clock_timestamp();
 if u.id is null or u.deleted_at is not null or u.is_anonymous is distinct from false
  or (u.banned_until is not null and u.banned_until>at) or s.id is null or (s.not_after is not null and s.not_after<=at)
  or b.id is null or b.principal_type<>'service' or b.status<>'active' or b.environment<>p_environment
  or b.valid_from>at or (b.valid_until is not null and b.valid_until<=at)
  or t.status is distinct from 'active' or o.status is distinct from 'active' or service.status is distinct from 'active'
  or permission.status is distinct from 'active' or permission.scope_type is distinct from 'tenant'
  or permission.requires_mfa or permission.requires_step_up
  or g.id is null or g.scope_json is distinct from jsonb_build_object('environment',p_environment)
  or g.valid_from>at or (g.valid_until is not null and g.valid_until<=at)
  or exists(select 1 from public.memberships where user_id=actor)
  or exists(select 1 from public.platform_memberships where user_id=actor) then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 return b.id;
end $$;
revoke all on function private.flexexa_assert_event_worker(uuid,text,text) from public,anon,authenticated,service_role;
create or replace function private.flexexa_assert_outbox_publisher(p_tenant_id uuid,p_environment text)
returns uuid language sql volatile security definer set search_path='' as $$
 select private.flexexa_assert_event_worker(p_tenant_id,p_environment,'events.publish')
$$;

create table public.inbox_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 organization_id uuid not null,
 event_id uuid not null,
 environment text not null check(environment in ('sandbox','production')),
 consumer_key text not null check(consumer_key='policy_readiness.v1'),
 principal_id uuid not null references private.flexexa_machine_principals(id) on delete restrict,
 session_id uuid not null,
 idempotency_record_id uuid not null,
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 status text not null check(status in ('processed','superseded')),
 response_json jsonb not null check(jsonb_typeof(response_json)='object'),
 processed_at timestamptz not null default clock_timestamp(),
 unique(tenant_id,id), unique(tenant_id,environment,consumer_key,event_id),
 foreign key(tenant_id,organization_id) references public.tenants(id,organization_id) on delete restrict,
 foreign key(tenant_id,event_id) references public.outbox_events(tenant_id,id) on delete restrict,
 foreign key(tenant_id,idempotency_record_id) references public.idempotency_records(tenant_id,id) on delete restrict
);
create index inbox_event_idx on public.inbox_events(tenant_id,event_id);
create index inbox_organization_idx on public.inbox_events(organization_id);
create index inbox_principal_idx on public.inbox_events(principal_id);
create index inbox_receipt_idx on public.inbox_events(tenant_id,idempotency_record_id);
alter table public.inbox_events enable row level security;
revoke all on public.inbox_events from public,anon,authenticated,service_role;
create trigger inbox_immutable before update or delete on public.inbox_events for each row execute function private.flexexa_deny_audit_mutation();

create function private.flexexa_consume_policy_publication(p_tenant_id uuid,p_environment text,p_event jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare principal uuid; event public.outbox_events%rowtype; prior public.inbox_events%rowtype;
 expected jsonb; h text; policy uuid; version public.policy_set_versions%rowtype;
 outcome text:='processed'; blockers jsonb:='["SANDBOX_ONLY"]'; min_kw numeric; max_kw numeric; denies boolean;
 receipt uuid; service uuid; response jsonb; audit uuid;
begin
 principal:=private.flexexa_assert_event_worker(p_tenant_id,p_environment,'events.consume');
 if p_event is null or jsonb_typeof(p_event)<>'object' or octet_length(p_event::text)>262144 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if private.flexexa_input_uuid(p_event,'tenant_id')<>p_tenant_id then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
 select * into event from public.outbox_events where tenant_id=p_tenant_id and id=private.flexexa_input_uuid(p_event,'event_id') for update;
 if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 perform private.flexexa_assert_event_worker(p_tenant_id,p_environment,'events.consume');
 expected:=jsonb_build_object('event_id',event.id,'tenant_id',event.tenant_id,'organization_id',event.organization_id,
  'event_type',event.event_type,'event_version',event.event_version,'occurred_at',to_char(event.occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'received_at',to_char(event.received_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'correlation_id',event.correlation_id,'causation_id',event.causation_id,'source',event.source,'payload',event.payload_json);
 if p_event<>expected or event.event_type not in ('policy.version.published','flexexa.policy.published') or event.event_version<>1
  or event.source<>'flexexa.policy' or event.payload_json->>'environment' is distinct from p_environment or p_environment<>'sandbox' then
  raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 h:=encode(extensions.digest(expected::text,'sha256'),'hex');
 select * into prior from public.inbox_events where tenant_id=p_tenant_id and environment=p_environment and consumer_key='policy_readiness.v1' and event_id=event.id;
 if found then
  if prior.request_hash<>h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  perform private.flexexa_assert_event_worker(p_tenant_id,p_environment,'events.consume');
  return prior.response_json;
 end if;
 select * into version from public.policy_set_versions where id=private.flexexa_input_uuid(event.payload_json,'policy_set_version_id');
 if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 policy:=version.policy_set_id;
 perform 1 from public.policy_sets where id=policy for update;
 perform private.flexexa_assert_event_worker(p_tenant_id,p_environment,'events.consume');
 if version.status<>'published' or version.checksum is distinct from event.payload_json->>'rules_checksum'
  or not exists(select 1 from private.flexexa_policy_publications where tenant_id=p_tenant_id and policy_set_version_id=version.id and environment=p_environment) then
  raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 if exists(select 1 from private.flexexa_policy_publications x join public.policy_set_versions v on v.id=x.policy_set_version_id where x.tenant_id=p_tenant_id and x.policy_set_id=policy and v.version>version.version) then
  outcome:='superseded';
 else
  select max((r.expression_json->>'minimum_kw')::numeric),min((r.expression_json->>'maximum_kw')::numeric),bool_or(r.expression_json->'deny_reasons'<>'[]'::jsonb)
   into min_kw,max_kw,denies from public.rule_versions r join public.policy_set_rule_versions m on m.rule_version_id=r.id where m.policy_set_version_id=version.id;
  if min_kw is null or max_kw is null or min_kw>max_kw or denies then blockers:=blockers||'"POLICY_DENIED"'::jsonb; end if;
  if version.valid_from>clock_timestamp() or version.valid_until<=clock_timestamp() then blockers:=blockers||'"POLICY_EXPIRED"'::jsonb; end if;
  update public.tenant_policy_readiness set status='blocked',blocking_reasons_json=blockers,warning_reasons_json='[]',evaluated_at=clock_timestamp(),evaluator_version='flexexa.power.v1.sandbox',updated_at=clock_timestamp()
   where tenant_id=p_tenant_id and policy_set_version_id=version.id and status<>'superseded';
  if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 end if;
 select service_identity_id into service from private.flexexa_machine_principals where id=principal;
 response:=jsonb_build_object('event_id',event.id,'tenant_id',p_tenant_id,'environment',p_environment,'consumer_key','policy_readiness.v1','status',outcome);
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
  values(p_tenant_id,'service',service,'consume_policy_publication',event.id::text,h,event.correlation_id) returning id into receipt;
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
  values(p_tenant_id,'service',service,'policy_readiness_evaluated','policy_set_version',version.id,event.correlation_id,receipt,jsonb_build_object('event_id',event.id,'environment',p_environment,'outcome',outcome)) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,causation_id,source,payload_json)
  values(p_tenant_id,event.organization_id,audit,'policy.readiness.evaluated',event.correlation_id,event.id,'flexexa.policy',jsonb_build_object('environment',p_environment,'policy_set_version_id',version.id,'consumer_status',outcome));
 insert into public.inbox_events(tenant_id,organization_id,event_id,environment,consumer_key,principal_id,session_id,idempotency_record_id,request_hash,status,response_json)
  values(p_tenant_id,event.organization_id,event.id,p_environment,'policy_readiness.v1',principal,(auth.jwt()->>'session_id')::uuid,receipt,h,outcome,response);
 update public.idempotency_records set status='completed',response_reference=event.id,response_json=response where id=receipt;
 perform private.flexexa_assert_event_worker(p_tenant_id,p_environment,'events.consume');
 return response;
end $$;
revoke all on function private.flexexa_consume_policy_publication(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.flexexa_consume_policy_publication(uuid,text,jsonb) to authenticated;
create function public.flexexa_consume_policy_publication(p_tenant_id uuid,p_environment text,p_event jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_consume_policy_publication(p_tenant_id,p_environment,p_event)$$;
revoke all on function public.flexexa_consume_policy_publication(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.flexexa_consume_policy_publication(uuid,text,jsonb) to authenticated;

-- Emit the locked V1 event name for new publications. Existing immutable custom
-- sandbox events remain valid inputs; neither event facts nor applied SQL are rewritten.
create or replace function private.flexexa_policy_workflow(action text,p jsonb,idem text,correlation uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); receipt uuid; prior public.idempotency_records%rowtype;
 h text; response jsonb; policy uuid; resource uuid; definition uuid; rule_id uuid;
 v public.policy_set_versions%rowtype; rule_item jsonb; test_item jsonb; target_item jsonb;
 start_at timestamptz; end_at timestamptz; rule_key_value text; name_value text;
 sequence_no integer; rule_no integer:=0; case_count integer:=0; all_passed boolean:=true;
 actual boolean; evidence jsonb:='[]'; row_rule record; target record; audit uuid; tenant_receipt uuid;
 min_kw numeric; max_kw numeric; denies boolean; blockers jsonb; at timestamptz;
begin
 perform private.flexexa_assert_policy_admin();
 if action is null or action not in ('create','test','shadow','approve','publish','readiness')
  or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>65536
  or idem is null or idem !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' or idem ~ '[^A-Za-z0-9_.:-]' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 perform private.flexexa_input_uuid(jsonb_build_object('id',correlation),'id');
 h:=encode(extensions.digest(p::text,'sha256'),'hex');
 insert into public.idempotency_records(scope_type,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
 values('platform','user',actor,'policy_'||action,idem,h,correlation)
 on conflict(actor_type,actor_id,operation_key,idempotency_key) where scope_type='platform' do nothing returning id into receipt;
 if receipt is null then
  select * into prior from public.idempotency_records where scope_type='platform' and actor_type='user' and actor_id=actor
   and operation_key='policy_'||action and idempotency_key=idem for update;
  perform private.flexexa_assert_policy_admin();
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status is distinct from 'completed' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 if action='create' then
  if exists(select 1 from jsonb_object_keys(p) k where k not in ('policy_key','name','valid_from','valid_until','rules','tenants')) then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  rule_key_value:=private.flexexa_input_text(p,'policy_key',true,120);
  name_value:=private.flexexa_input_text(p,'name',true,120);
  if rule_key_value !~ '^[a-z][a-z0-9_.]{0,119}$' or jsonb_typeof(p->'rules') is distinct from 'array'
   or jsonb_typeof(p->'tenants') is distinct from 'array' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  if jsonb_array_length(p->'rules') not between 1 and 64 or jsonb_array_length(p->'tenants') not between 1 and 1000 then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  start_at:=private.flexexa_policy_instant(p,'valid_from'); end_at:=private.flexexa_policy_instant(p,'valid_until');
  if end_at<=start_at then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  insert into public.policy_sets(policy_key,domain,name,criticality) values(rule_key_value,'power',name_value,'critical')
   on conflict(policy_key) do nothing;
  select id into policy from public.policy_sets where policy_key=rule_key_value and name=name_value and domain='power' and status='active' for update;
  if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
  select coalesce(max(version),0)+1 into sequence_no from public.policy_set_versions where policy_set_id=policy;
  insert into public.policy_set_versions(policy_set_id,version,checksum,valid_from,valid_until,created_by)
   values(policy,sequence_no,h,start_at,end_at,actor) returning * into v;
  resource:=v.id;
  for target_item in select value from jsonb_array_elements(p->'tenants') order by value::text loop
   definition:=private.flexexa_input_uuid(jsonb_build_object('id',target_item),'id');
   perform 1 from public.tenants t join public.organizations o on o.id=t.organization_id
    where t.id=definition and t.status='active' and o.status='active' for share of t,o;
   if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   insert into private.flexexa_policy_targets values(definition,resource);
  end loop;
  -- Sorted definition locks prevent opposite-order authoring deadlocks.
  for rule_item in select value from jsonb_array_elements(p->'rules') order by value->>'rule_key' loop
   if jsonb_typeof(rule_item)<>'object' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   if exists(select 1 from jsonb_object_keys(rule_item) k where k not in ('rule_key','expression','tests')) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   rule_key_value:=private.flexexa_input_text(rule_item,'rule_key',true,120);
   if rule_key_value !~ '^[a-z][a-z0-9_.]{0,119}$' or jsonb_typeof(rule_item->'tests') is distinct from 'array' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   if jsonb_array_length(rule_item->'tests') not between 1 and 32 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   perform private.flexexa_validate_power_rule(rule_item->'expression');
   insert into public.rule_definitions(rule_key,domain,name,scope_type,rule_type,input_schema_json,output_schema_json,default_effect,criticality,execution_mode)
    values(rule_key_value,'power',rule_key_value,'platform','power_limit','{"requested_kw":"number"}','{"allowed":"boolean"}','deny','critical','deterministic') on conflict(rule_key) do nothing;
   select id into definition from public.rule_definitions where rule_key=rule_key_value and domain='power' and status='active' for update;
   if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   if exists(select 1 from public.policy_set_rule_versions m join public.rule_versions r on r.id=m.rule_version_id
    where m.policy_set_version_id=resource and r.rule_definition_id=definition) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   select coalesce(max(version),0)+1 into sequence_no from public.rule_versions where rule_definition_id=definition;
   insert into public.rule_versions(rule_definition_id,version,expression_language,expression_json,checksum,valid_from,valid_until,created_by)
    values(definition,sequence_no,'flexexa.power.v1',rule_item->'expression',encode(extensions.digest(rule_item::text,'sha256'),'hex'),start_at,end_at,actor) returning id into rule_id;
   rule_no:=rule_no+1;
   insert into public.policy_set_rule_versions(policy_set_version_id,rule_version_id,priority) values(resource,rule_id,rule_no);
   for test_item in select value from jsonb_array_elements(rule_item->'tests') loop
    if jsonb_typeof(test_item)<>'object' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    if exists(select 1 from jsonb_object_keys(test_item) k where k not in ('name','requested_kw','expected_allowed'))
     or jsonb_typeof(test_item->'requested_kw') is distinct from 'number' or jsonb_typeof(test_item->'expected_allowed') is distinct from 'boolean' then
     raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    perform private.flexexa_test_power_rule(rule_item->'expression',(test_item->>'requested_kw')::numeric);
    insert into public.rule_test_cases(rule_version_id,name,input_json,expected_json)
     values(rule_id,private.flexexa_input_text(test_item,'name',true,120),jsonb_build_object('requested_kw',test_item->'requested_kw'),jsonb_build_object('allowed',test_item->'expected_allowed'));
   end loop;
  end loop;
 else
  if exists(select 1 from jsonb_object_keys(p) k where k not in ('policy_set_version_id','observations'))
   or (action<>'shadow' and p ? 'observations') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  resource:=private.flexexa_input_uuid(p,'policy_set_version_id');
  -- All transitions/publications for a policy serialize on its stable parent.
  select policy_set_id into policy from public.policy_set_versions where id=resource;
  if policy is null then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
  perform 1 from public.policy_sets where id=policy for update;
  select * into v from public.policy_set_versions where id=resource for update;
  perform private.flexexa_assert_policy_admin();
  case action
  when 'test' then
   if v.status<>'draft' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
   for row_rule in select r.id,r.expression_json,t.id test_id,t.input_json,t.expected_json
    from public.policy_set_rule_versions m join public.rule_versions r on r.id=m.rule_version_id
    join public.rule_test_cases t on t.rule_version_id=r.id and t.status='active' where m.policy_set_version_id=resource order by r.id,t.id loop
    actual:=private.flexexa_test_power_rule(row_rule.expression_json,(row_rule.input_json->>'requested_kw')::numeric);
    all_passed:=all_passed and actual=(row_rule.expected_json->>'allowed')::boolean; case_count:=case_count+1;
    evidence:=evidence||jsonb_build_array(jsonb_build_object('test_id',row_rule.test_id,'allowed',actual,'expected',row_rule.expected_json->'allowed'));
   end loop;
   if case_count=0 then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   insert into private.flexexa_policy_test_runs(policy_set_version_id,rules_checksum,stage,passed,cases_count,evidence_json,actor_id)
    values(resource,v.checksum,'automated',all_passed,case_count,evidence,actor);
   if all_passed then
    update public.rule_versions set status='testing' where id in(select rule_version_id from public.policy_set_rule_versions where policy_set_version_id=resource);
    update public.policy_set_versions set status='testing' where id=resource;
   end if;
  when 'shadow' then
   if v.status<>'testing' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
   if jsonb_typeof(p->'observations') is distinct from 'array' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   if jsonb_array_length(p->'observations') not between 1 and 256 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   for test_item in select value from jsonb_array_elements(p->'observations') loop
    if jsonb_typeof(test_item)<>'object' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    if exists(select 1 from jsonb_object_keys(test_item) k where k not in ('requested_kw','expected_allowed'))
     or jsonb_typeof(test_item->'requested_kw') is distinct from 'number' or jsonb_typeof(test_item->'expected_allowed') is distinct from 'boolean' then
     raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    actual:=true;
    for row_rule in select r.expression_json from public.rule_versions r join public.policy_set_rule_versions m on m.rule_version_id=r.id where m.policy_set_version_id=resource loop
     actual:=private.flexexa_test_power_rule(row_rule.expression_json,(test_item->>'requested_kw')::numeric) and actual;
    end loop;
    all_passed:=all_passed and actual=(test_item->>'expected_allowed')::boolean; case_count:=case_count+1;
    evidence:=evidence||jsonb_build_array(test_item||jsonb_build_object('allowed',actual));
   end loop;
   insert into private.flexexa_policy_test_runs(policy_set_version_id,rules_checksum,stage,passed,cases_count,evidence_json,actor_id)
    values(resource,v.checksum,'sandbox_shadow',all_passed,case_count,evidence,actor);
  when 'approve' then
   if v.status<>'testing' or v.created_by=actor then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   if (select passed from private.flexexa_policy_test_runs where policy_set_version_id=resource and rules_checksum=v.checksum and stage='automated' order by created_at desc,id desc limit 1) is distinct from true
    or (select passed from private.flexexa_policy_test_runs where policy_set_version_id=resource and rules_checksum=v.checksum and stage='sandbox_shadow' order by created_at desc,id desc limit 1) is distinct from true then
    raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   update public.rule_versions set status='approved',approved_by=actor,approved_at=clock_timestamp()
    where id in(select rule_version_id from public.policy_set_rule_versions where policy_set_version_id=resource);
   update public.policy_set_versions set status='approved',approved_by=actor,approved_at=clock_timestamp() where id=resource;
  when 'publish' then
   at:=clock_timestamp();
   if v.status<>'approved' or v.valid_from>at or v.valid_until<=at or exists(select 1 from public.policy_set_versions where policy_set_id=policy and version>v.version and status='published') then
    raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   for target in select t.id,t.organization_id from private.flexexa_policy_targets x join public.tenants t on t.id=x.tenant_id where x.policy_set_version_id=resource order by t.id loop
    perform 1 from public.tenants t join public.organizations o on o.id=t.organization_id where t.id=target.id and t.status='active' and o.status='active' for share of t,o;
    if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
    insert into private.flexexa_policy_publications(tenant_id,policy_set_id,policy_set_version_id,environment,published_by) values(target.id,policy,resource,'sandbox',actor);
    update public.tenant_policy_readiness set status='superseded',updated_at=clock_timestamp() where tenant_id=target.id
     and policy_set_version_id in(select id from public.policy_set_versions where policy_set_id=policy) and status<>'superseded';
    insert into public.tenant_policy_readiness(tenant_id,policy_set_version_id) values(target.id,resource);
    insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
     values(target.id,'user',actor,'policy_publication',resource::text,v.checksum,correlation) returning id into tenant_receipt;
    insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
     values(target.id,'user',actor,'policy_publish','policy_set_version',resource,correlation,tenant_receipt,jsonb_build_object('environment','sandbox','checksum',v.checksum)) returning id into audit;
    insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
     values(target.id,target.organization_id,audit,'policy.version.published',correlation,'flexexa.policy',jsonb_build_object('environment','sandbox','policy_set_version_id',resource,'rules_checksum',v.checksum));
    update public.idempotency_records set status='completed',response_reference=resource,response_json=jsonb_build_object('policy_set_version_id',resource,'environment','sandbox') where id=tenant_receipt;
   end loop;
   update public.rule_versions set status='published' where id in(select rule_version_id from public.policy_set_rule_versions where policy_set_version_id=resource);
   update public.policy_set_versions set status='published' where id=resource;
  when 'readiness' then
   if v.status<>'published' or not exists(select 1 from private.flexexa_policy_publications x where x.policy_set_version_id=resource
    and not exists(select 1 from private.flexexa_policy_publications newer join public.policy_set_versions nv on nv.id=newer.policy_set_version_id
     where newer.tenant_id=x.tenant_id and newer.policy_set_id=policy and nv.version>v.version)) then
    raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   select max((r.expression_json->>'minimum_kw')::numeric),min((r.expression_json->>'maximum_kw')::numeric),bool_or(r.expression_json->'deny_reasons'<>'[]'::jsonb)
    into min_kw,max_kw,denies from public.rule_versions r join public.policy_set_rule_versions m on m.rule_version_id=r.id where m.policy_set_version_id=resource;
   for target in select t.id,t.status,o.status organization_status from private.flexexa_policy_publications x join public.tenants t on t.id=x.tenant_id join public.organizations o on o.id=t.organization_id
    where x.policy_set_version_id=resource and not exists(select 1 from private.flexexa_policy_publications newer
     join public.policy_set_versions nv on nv.id=newer.policy_set_version_id where newer.tenant_id=t.id and newer.policy_set_id=policy and nv.version>v.version)
    order by t.id for share of t,o loop
    -- Sandbox evidence is never production readiness or control authorization.
    blockers:='["SANDBOX_ONLY"]';
    if min_kw>max_kw or denies then blockers:=blockers||'"POLICY_DENIED"'::jsonb; end if;
    if v.valid_from>clock_timestamp() or v.valid_until<=clock_timestamp() then blockers:=blockers||'"POLICY_EXPIRED"'::jsonb; end if;
    if target.status<>'active' or target.organization_status<>'active' then blockers:=blockers||'"TENANT_INACTIVE"'::jsonb; end if;
    update public.tenant_policy_readiness set status='blocked',blocking_reasons_json=blockers,warning_reasons_json='[]',evaluated_at=clock_timestamp(),evaluator_version='flexexa.power.v1.sandbox',updated_at=clock_timestamp()
     where tenant_id=target.id and policy_set_version_id=resource;
   end loop;
  end case;
 end if;
 perform private.flexexa_assert_policy_admin();
 if action='publish' and v.valid_until<=clock_timestamp() then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 response:=jsonb_build_object('policy_set_version_id',resource,'status',(select status from public.policy_set_versions where id=resource),'environment','sandbox','correlation_id',correlation);
 if action in ('test','shadow') then response:=response||jsonb_build_object('passed',all_passed,'cases_count',case_count); end if;
 insert into public.audit_events(scope_type,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
  values('platform','user',actor,'policy_'||action,'policy_set_version',resource,correlation,receipt,jsonb_build_object('environment','sandbox','request_hash',h));
 update public.idempotency_records set status='completed',response_reference=resource,response_json=response where id=receipt;
 return response;
exception when unique_violation or foreign_key_violation or check_violation or numeric_value_out_of_range then
 raise exception using errcode='P0001',message='VALIDATION_ERROR';
end $$;
