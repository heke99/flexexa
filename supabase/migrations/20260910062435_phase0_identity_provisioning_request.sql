-- Durable intent only. A request is not an Auth user, credential, permission or worker lease.
create table private.flexexa_identity_provisioning_requests (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 api_client_id uuid not null,
 environment text not null check(environment in ('sandbox','production')),
 intended_auth_user_id uuid not null unique default gen_random_uuid(),
 requested_by uuid not null,
 idempotency_record_id uuid not null,
 created_at timestamptz not null default statement_timestamp(),
 expires_at timestamptz not null,
 unique(tenant_id,id),
 unique(tenant_id,idempotency_record_id),
 foreign key(tenant_id,api_client_id) references public.api_clients(tenant_id,id) on delete restrict,
 foreign key(tenant_id,idempotency_record_id) references public.idempotency_records(tenant_id,id) on delete restrict,
 check(isfinite(created_at) and isfinite(expires_at) and expires_at>created_at)
);
create index identity_provisioning_client_idx on private.flexexa_identity_provisioning_requests(tenant_id,api_client_id);
alter table private.flexexa_identity_provisioning_requests enable row level security;
revoke all on private.flexexa_identity_provisioning_requests from public,anon,authenticated;
create trigger identity_provisioning_request_immutable before update or delete on private.flexexa_identity_provisioning_requests
 for each row execute function private.flexexa_deny_audit_mutation();
comment on table private.flexexa_identity_provisioning_requests is
 'Immutable expiring provisioning intent. Intended Auth UUID is reserved before external I/O, deliberately has no auth.users FK until a user exists. Requested actor survives deletion. No secret or second API client catalog. Workers must reauthorize, validate expiry and acquire a durable execution lease before any Auth call.';

create function private.flexexa_request_api_identity_provisioning(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); client uuid; environment text; normalized jsonb; h text; receipt uuid;
 prior public.idempotency_records%rowtype; account public.api_clients%rowtype;
 intent private.flexexa_identity_provisioning_requests%rowtype; response jsonb; audit uuid; org uuid;
begin
 -- Reauthorize even for historical retries; never use request/receipt as bearer authority.
 perform private.flexexa_assert_identity_administrator(p_tenant_id);
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_tenant_id),'id');
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 if p_idempotency_key is null or p_idempotency_key ~ '[^A-Za-z0-9_.:-]' or
  p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('api_client_id','environment')) then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 client:=private.flexexa_input_uuid(p_payload,'api_client_id'); environment:=p_payload->>'environment';
 if jsonb_typeof(p_payload->'environment') is distinct from 'string' or environment not in ('sandbox','production') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 normalized:=jsonb_build_object('api_client_id',client,'environment',environment);
 h:=encode(extensions.digest(normalized::text,'sha256'),'hex');
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
  values(p_tenant_id,'user',actor,'request_api_identity_provisioning',p_idempotency_key,h,p_correlation_id)
  on conflict(tenant_id,actor_type,actor_id,operation_key,idempotency_key) do nothing returning id into receipt;
 if receipt is null then
  select * into prior from public.idempotency_records where tenant_id=p_tenant_id and actor_type='user' and actor_id=actor
   and operation_key='request_api_identity_provisioning' and idempotency_key=p_idempotency_key for update;
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status<>'completed' or prior.response_json is null then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 select * into account from public.api_clients where tenant_id=p_tenant_id and id=client for share;
 if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
 if account.status<>'active' or account.client_type not in ('confidential','api_key') or account.expires_at is null
  or not isfinite(account.expires_at) or account.expires_at<=statement_timestamp() then
  raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 -- Fifteen minutes is an upper bound on this intent, never an authorization lifetime.
 insert into private.flexexa_identity_provisioning_requests(tenant_id,api_client_id,environment,requested_by,idempotency_record_id,expires_at)
  values(p_tenant_id,client,environment,actor,receipt,least(account.expires_at,statement_timestamp()+interval '15 minutes')) returning * into intent;
 response:=jsonb_build_object('tenant_id',p_tenant_id,'resource_type','identity_provisioning_request','resource_id',intent.id,
  'api_client_id',client,'intended_auth_user_id',intent.intended_auth_user_id,'environment',environment,
  'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'status','requested');
 select organization_id into org from public.tenants where id=p_tenant_id;
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
  values(p_tenant_id,'user',actor,'request_api_identity_provisioning','identity_provisioning_request',intent.id,p_correlation_id,receipt,
   jsonb_build_object('schema_version',1,'api_client_id',client,'environment',environment)) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
  values(p_tenant_id,org,audit,'flexexa.api_identity_provisioning.requested',p_correlation_id,'flexexa.identity',
   jsonb_build_object('resource_id',intent.id,'api_client_id',client,'environment',environment));
 update public.idempotency_records set status='completed',response_reference=intent.id,response_json=response where id=receipt and tenant_id=p_tenant_id;
 return response;
exception when unique_violation or foreign_key_violation or check_violation or numeric_value_out_of_range then
 raise exception using errcode='P0001',message='VALIDATION_ERROR';
end $$;
revoke all on function private.flexexa_request_api_identity_provisioning(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.flexexa_request_api_identity_provisioning(uuid,jsonb,text,uuid) to authenticated;
create function public.flexexa_request_api_identity_provisioning(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_request_api_identity_provisioning(p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)
$$;
revoke all on function public.flexexa_request_api_identity_provisioning(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.flexexa_request_api_identity_provisioning(uuid,jsonb,text,uuid) to authenticated;
