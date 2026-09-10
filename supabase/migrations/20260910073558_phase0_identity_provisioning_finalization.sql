-- Finalize a pre-provisioned, pre-attested reserved Auth UUID. No external Auth I/O.
alter table private.flexexa_identity_execution_leases add constraint identity_lease_request_identity_unique unique(tenant_id,request_id,id);
alter table private.flexexa_machine_principals add constraint machine_principal_tenant_identity_unique unique(tenant_id,id);
create table private.flexexa_identity_provisioning_completions (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 request_id uuid not null,
 lease_id uuid not null,
 principal_id uuid not null,
 idempotency_record_id uuid not null,
 created_at timestamptz not null default clock_timestamp() check(isfinite(created_at)),
 unique(tenant_id,id),
 unique(tenant_id,request_id),
 unique(tenant_id,lease_id),
 unique(tenant_id,principal_id),
 unique(tenant_id,idempotency_record_id),
 foreign key(tenant_id,request_id) references private.flexexa_identity_provisioning_requests(tenant_id,id) on delete restrict,
 foreign key(tenant_id,request_id,lease_id) references private.flexexa_identity_execution_leases(tenant_id,request_id,id) on delete restrict,
 foreign key(tenant_id,principal_id) references private.flexexa_machine_principals(tenant_id,id) on delete restrict,
 foreign key(tenant_id,idempotency_record_id) references public.idempotency_records(tenant_id,id) on delete restrict
);
alter table private.flexexa_identity_provisioning_completions enable row level security;
revoke all on private.flexexa_identity_provisioning_completions from public,anon,authenticated;
create trigger identity_provisioning_completion_immutable before update or delete on private.flexexa_identity_provisioning_completions
 for each row execute function private.flexexa_deny_audit_mutation();
comment on table private.flexexa_identity_provisioning_completions is
 'Terminal immutable evidence joining one provisioning request, its current execution lease and the enrolled canonical principal. Composite FKs enforce tenant/request ownership. No credentials or alternate client catalog.';

create function private.flexexa_finalize_identity_provisioning(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); lease_id uuid; environment text; h text; receipt uuid;
 lease private.flexexa_identity_execution_leases%rowtype; intent private.flexexa_identity_provisioning_requests%rowtype;
 completion private.flexexa_identity_provisioning_completions%rowtype; prior public.idempotency_records%rowtype;
 enrollment jsonb; response jsonb; audit uuid; org uuid;
begin
 perform private.flexexa_assert_identity_administrator(p_tenant_id);
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 if p_idempotency_key is null or p_idempotency_key ~ '[^A-Za-z0-9_.:-]' or
  p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('lease_id','environment')) then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 lease_id:=private.flexexa_input_uuid(p_payload,'lease_id'); environment:=p_payload->>'environment';
 if jsonb_typeof(p_payload->'environment') is distinct from 'string' or environment not in ('sandbox','production') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 select * into lease from private.flexexa_identity_execution_leases where tenant_id=p_tenant_id and id=lease_id;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 -- Same request lock as acquisition/check. Completion and reacquisition cannot pass each other.
 select * into intent from private.flexexa_identity_provisioning_requests
  where tenant_id=p_tenant_id and id=lease.request_id and requested_by=actor for update;
 if not found or intent.environment is distinct from environment then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 if not private.flexexa_has_permission_at(p_tenant_id,'api_clients.manage',clock_timestamp()) then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=actor
  and (not_after is null or not_after>clock_timestamp())) then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 h:=encode(extensions.digest(jsonb_build_object('lease_id',lease_id,'environment',environment)::text,'sha256'),'hex');
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
  values(p_tenant_id,'user',actor,'finalize_identity_provisioning',p_idempotency_key,h,p_correlation_id)
  on conflict(tenant_id,actor_type,actor_id,operation_key,idempotency_key) do nothing returning id into receipt;
 if receipt is null then
  select * into prior from public.idempotency_records where tenant_id=p_tenant_id and actor_type='user' and actor_id=actor
   and operation_key='finalize_identity_provisioning' and idempotency_key=p_idempotency_key for update;
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status<>'completed' or prior.response_json is null then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  -- Historical completion may replay after lease expiry. It performs no enrollment/authorization grant.
  return prior.response_json;
 end if;
 if exists(select 1 from private.flexexa_identity_provisioning_completions where tenant_id=p_tenant_id and request_id=intent.id) then
  raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 perform private.flexexa_check_identity_execution_lease(p_tenant_id,lease_id);
 -- Reuse canonical enrollment checks/evidence. The internal key uses the new server receipt UUID,
 -- not caller-controlled identity fields or a reusable externally chosen enrollment key.
 enrollment:=private.flexexa_administer_api_identity('enroll',p_tenant_id,
  jsonb_build_object('api_client_id',intent.api_client_id,'auth_user_id',intent.intended_auth_user_id,'environment',intent.environment),
  'provision-finalize:'||receipt::text,p_correlation_id);
 -- Enrollment may have waited for the Auth user row. Expiry/revocation must roll back ALL writes.
 perform private.flexexa_check_identity_execution_lease(p_tenant_id,lease_id);
 insert into private.flexexa_identity_provisioning_completions(tenant_id,request_id,lease_id,principal_id,idempotency_record_id)
  values(p_tenant_id,intent.id,lease_id,(enrollment->>'resource_id')::uuid,receipt) returning * into completion;
 response:=jsonb_build_object('tenant_id',p_tenant_id,'resource_type','identity_provisioning_completion','resource_id',completion.id,
  'request_id',intent.id,'lease_id',lease_id,'principal_id',completion.principal_id,'generation',lease.generation,'environment',intent.environment,
  'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'status','completed');
 select organization_id into org from public.tenants where id=p_tenant_id;
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
  values(p_tenant_id,'user',actor,'finalize_identity_provisioning','identity_provisioning_completion',completion.id,p_correlation_id,receipt,
   jsonb_build_object('schema_version',1,'request_id',intent.id,'lease_id',lease_id,'principal_id',completion.principal_id,'environment',intent.environment)) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
  values(p_tenant_id,org,audit,'flexexa.api_identity_provisioning.completed',p_correlation_id,'flexexa.identity',
   jsonb_build_object('resource_id',completion.id,'request_id',intent.id,'principal_id',completion.principal_id,'environment',intent.environment));
 update public.idempotency_records set status='completed',response_reference=completion.id,response_json=response where tenant_id=p_tenant_id and id=receipt;
 return response;
end $$;
revoke all on function private.flexexa_finalize_identity_provisioning(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.flexexa_finalize_identity_provisioning(uuid,jsonb,text,uuid) to authenticated;
create function public.flexexa_finalize_identity_provisioning(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_finalize_identity_provisioning(p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)
$$;
revoke all on function public.flexexa_finalize_identity_provisioning(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.flexexa_finalize_identity_provisioning(uuid,jsonb,text,uuid) to authenticated;
create or replace function private.flexexa_lock_identity_execution_request(p_tenant_id uuid,p_request_id uuid)
returns private.flexexa_identity_provisioning_requests language plpgsql volatile security definer set search_path='' as $$
declare intent private.flexexa_identity_provisioning_requests%rowtype; account public.api_clients%rowtype; at timestamptz;
begin
 perform private.flexexa_assert_identity_administrator(p_tenant_id);
 select * into intent from private.flexexa_identity_provisioning_requests
  where tenant_id=p_tenant_id and id=p_request_id and requested_by=auth.uid() for update;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 if exists(select 1 from private.flexexa_identity_provisioning_completions where tenant_id=p_tenant_id and request_id=p_request_id) then
  raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 select * into account from public.api_clients where tenant_id=p_tenant_id and id=intent.api_client_id for share;
 at:=clock_timestamp();
 if account.status is distinct from 'active' or account.client_type not in ('confidential','api_key')
  or account.expires_at is null or not isfinite(account.expires_at) or account.expires_at<=at or intent.expires_at<=at then
  raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 -- Auth user/session locks prevent those records being revoked within this transaction.
 -- Recheck canonical permission at wall time after the request/client locks, including
 -- membership/grant expiry and newly effective explicit denies.
 if not private.flexexa_has_permission_at(p_tenant_id,'api_clients.manage',at) then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 -- Check temporal session expiry again after potentially waiting on the intent/client locks.
 if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid()
  and (not_after is null or not_after>at)) then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 return intent;
end $$;
