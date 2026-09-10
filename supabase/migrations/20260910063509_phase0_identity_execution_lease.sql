-- Session-authorized coordination only; no Auth I/O or credential authority.
-- One permission evaluator with an explicit internal evaluation time. Existing callers
-- retain transaction-time behavior; execution coordination rechecks wall time after locks.
create function private.flexexa_has_permission_at(p_tenant_id uuid,p_permission_key text,p_at timestamptz)
returns boolean language sql stable security definer set search_path='' as $$
 with member as(
  select m.id from public.memberships m
  join public.tenants t on t.id=m.tenant_id and t.status='active'
  join public.organizations o on o.id=t.organization_id and o.status='active'
  where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active'
   and m.valid_from<=p_at and (m.valid_until is null or m.valid_until>p_at)
   and coalesce(auth.jwt()->>'is_anonymous','false')='false'
 ),
 target as(select p.* from public.permissions p where p.permission_key=private.flexexa_canonical_permission(p_permission_key) and p.status='active' and p.scope_type='tenant'),
 grants as(
  select rp.effect,rp.condition_json from member m
  join public.membership_roles mr on mr.tenant_id=p_tenant_id and mr.membership_id=m.id
  join public.roles r on r.id=mr.role_id and r.tenant_id=p_tenant_id and r.status='active' and r.scope_type='tenant'
  join public.role_permissions rp on rp.role_id=r.id and rp.tenant_id=p_tenant_id
  join public.permissions p on p.id=rp.permission_id and p.status<>'retired'
  join target t on t.permission_key=private.flexexa_canonical_permission(p.permission_key)
  where mr.valid_from<=p_at and (mr.valid_until is null or mr.valid_until>p_at) and rp.valid_from<=p_at and (rp.valid_until is null or rp.valid_until>p_at)
  union all
  select x.effect,x.condition_json from member m
  join public.membership_permission_overrides x on x.tenant_id=p_tenant_id and x.membership_id=m.id
  join public.permissions p on p.id=x.permission_id and p.status<>'retired'
  join target t on t.permission_key=private.flexexa_canonical_permission(p.permission_key)
  where x.valid_from<=p_at and (x.valid_until is null or x.valid_until>p_at)
 )
 select exists(select 1 from member m cross join target t where m.id is not null
  and (not t.requires_mfa or coalesce(auth.jwt()->>'aal','')='aal2')
  and not t.requires_step_up
  and not exists(select 1 from grants where effect='deny')
  and exists(select 1 from grants where effect='allow' and condition_json='{}'::jsonb))
$$;
revoke all on function private.flexexa_has_permission_at(uuid,text,timestamptz) from public,anon,authenticated;
create or replace function private.flexexa_has_permission(p_tenant_id uuid,p_permission_key text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.flexexa_has_permission_at(p_tenant_id,p_permission_key,now())
$$;

create table private.flexexa_identity_execution_leases (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 request_id uuid not null,
 generation integer not null check(generation>0),
 session_id uuid not null,
 idempotency_record_id uuid not null,
 created_at timestamptz not null,
 expires_at timestamptz not null,
 unique(tenant_id,id),
 unique(tenant_id,request_id,generation),
 unique(tenant_id,idempotency_record_id),
 foreign key(tenant_id,request_id) references private.flexexa_identity_provisioning_requests(tenant_id,id) on delete restrict,
 foreign key(tenant_id,idempotency_record_id) references public.idempotency_records(tenant_id,id) on delete restrict,
 check(isfinite(created_at) and isfinite(expires_at) and expires_at>created_at and expires_at<=created_at+interval '30 seconds')
);
alter table private.flexexa_identity_execution_leases enable row level security;
revoke all on private.flexexa_identity_execution_leases from public,anon,authenticated;
create trigger identity_execution_lease_immutable before update or delete on private.flexexa_identity_execution_leases
 for each row execute function private.flexexa_deny_audit_mutation();
comment on table private.flexexa_identity_execution_leases is
 'Append-only 30-second session-bound coordination attempts. Generation increases under the intent row lock. A lease is not Auth credential authority and cannot fence remote Auth calls. Every continuation must reauthorize; reserved Auth UUID remains unchanged.';

create function private.flexexa_lock_identity_execution_request(p_tenant_id uuid,p_request_id uuid)
returns private.flexexa_identity_provisioning_requests language plpgsql volatile security definer set search_path='' as $$
declare intent private.flexexa_identity_provisioning_requests%rowtype; account public.api_clients%rowtype; at timestamptz;
begin
 perform private.flexexa_assert_identity_administrator(p_tenant_id);
 select * into intent from private.flexexa_identity_provisioning_requests
  where tenant_id=p_tenant_id and id=p_request_id and requested_by=auth.uid() for update;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
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
revoke all on function private.flexexa_lock_identity_execution_request(uuid,uuid) from public,anon,authenticated;

create function private.flexexa_acquire_identity_execution_lease(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare intent private.flexexa_identity_provisioning_requests%rowtype; lease private.flexexa_identity_execution_leases%rowtype;
 prior public.idempotency_records%rowtype; actor uuid:=auth.uid(); session uuid; request uuid; h text; receipt uuid;
 at timestamptz; response jsonb; audit uuid; org uuid;
begin
 perform private.flexexa_assert_identity_administrator(p_tenant_id);
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 if p_idempotency_key is null or p_idempotency_key ~ '[^A-Za-z0-9_.:-]' or
  p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>4096 then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if exists(select 1 from jsonb_object_keys(p_payload) k where k not in ('request_id','environment')) then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 request:=private.flexexa_input_uuid(p_payload,'request_id');
 if jsonb_typeof(p_payload->'environment') is distinct from 'string' or p_payload->>'environment' not in ('sandbox','production') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 intent:=private.flexexa_lock_identity_execution_request(p_tenant_id,request);
 if intent.environment is distinct from p_payload->>'environment' then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 session:=(auth.jwt()->>'session_id')::uuid;
 h:=encode(extensions.digest(jsonb_build_object('request_id',request,'environment',intent.environment,'session_id',session)::text,'sha256'),'hex');
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
  values(p_tenant_id,'user',actor,'acquire_identity_execution_lease',p_idempotency_key,h,p_correlation_id)
  on conflict(tenant_id,actor_type,actor_id,operation_key,idempotency_key) do nothing returning id into receipt;
 select * into lease from private.flexexa_identity_execution_leases where tenant_id=p_tenant_id and request_id=request
  order by generation desc limit 1;
 at:=clock_timestamp();
 if receipt is null then
  select * into prior from public.idempotency_records where tenant_id=p_tenant_id and actor_type='user' and actor_id=actor
   and operation_key='acquire_identity_execution_lease' and idempotency_key=p_idempotency_key for update;
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status<>'completed' or prior.response_json is null or lease.idempotency_record_id is distinct from prior.id or lease.expires_at<=at then
   raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 if lease.expires_at>at then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 insert into private.flexexa_identity_execution_leases(tenant_id,request_id,generation,session_id,idempotency_record_id,created_at,expires_at)
  values(p_tenant_id,request,coalesce(lease.generation,0)+1,session,receipt,at,least(intent.expires_at,at+interval '30 seconds')) returning * into lease;
 response:=jsonb_build_object('tenant_id',p_tenant_id,'resource_type','identity_execution_lease','resource_id',lease.id,
  'request_id',request,'generation',lease.generation,'api_client_id',intent.api_client_id,'intended_auth_user_id',intent.intended_auth_user_id,
  'environment',intent.environment,'expires_at',lease.expires_at,'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'status','leased');
 select organization_id into org from public.tenants where id=p_tenant_id;
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
  values(p_tenant_id,'user',actor,'acquire_identity_execution_lease','identity_execution_lease',lease.id,p_correlation_id,receipt,
   jsonb_build_object('schema_version',1,'request_id',request,'generation',lease.generation,'environment',intent.environment)) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
  values(p_tenant_id,org,audit,'flexexa.identity_execution.leased',p_correlation_id,'flexexa.identity',
   jsonb_build_object('resource_id',lease.id,'request_id',request,'generation',lease.generation,'environment',intent.environment));
 update public.idempotency_records set status='completed',response_reference=lease.id,response_json=response where tenant_id=p_tenant_id and id=receipt;
 return response;
end $$;
revoke all on function private.flexexa_acquire_identity_execution_lease(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.flexexa_acquire_identity_execution_lease(uuid,jsonb,text,uuid) to authenticated;
create function public.flexexa_acquire_identity_execution_lease(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_acquire_identity_execution_lease(p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)
$$;
revoke all on function public.flexexa_acquire_identity_execution_lease(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.flexexa_acquire_identity_execution_lease(uuid,jsonb,text,uuid) to authenticated;

create function private.flexexa_check_identity_execution_lease(p_tenant_id uuid,p_lease_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare lease private.flexexa_identity_execution_leases%rowtype; intent private.flexexa_identity_provisioning_requests%rowtype;
begin
 perform private.flexexa_assert_identity_administrator(p_tenant_id);
 select * into lease from private.flexexa_identity_execution_leases where tenant_id=p_tenant_id and id=p_lease_id;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 intent:=private.flexexa_lock_identity_execution_request(p_tenant_id,lease.request_id);
 if lease.session_id is distinct from (auth.jwt()->>'session_id')::uuid or lease.expires_at<=clock_timestamp()
  or exists(select 1 from private.flexexa_identity_execution_leases where tenant_id=p_tenant_id and request_id=lease.request_id and generation>lease.generation) then
  raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 return jsonb_build_object('tenant_id',p_tenant_id,'lease_id',lease.id,'request_id',lease.request_id,'generation',lease.generation,
  'api_client_id',intent.api_client_id,'intended_auth_user_id',intent.intended_auth_user_id,'environment',intent.environment,'expires_at',lease.expires_at);
end $$;
revoke all on function private.flexexa_check_identity_execution_lease(uuid,uuid) from public,anon,authenticated;
grant execute on function private.flexexa_check_identity_execution_lease(uuid,uuid) to authenticated;
create function public.flexexa_check_identity_execution_lease(p_tenant_id uuid,p_lease_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_check_identity_execution_lease(p_tenant_id,p_lease_id)
$$;
revoke all on function public.flexexa_check_identity_execution_lease(uuid,uuid) from public,anon,authenticated;
grant execute on function public.flexexa_check_identity_execution_lease(uuid,uuid) to authenticated;
