-- Audited enrollment of previously provisioned dedicated Auth users. No credentials are created here.
create function private.flexexa_assert_identity_administrator(p_tenant_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); session uuid; claims jsonb:=auth.jwt(); at timestamptz:=statement_timestamp();
begin
 if actor is null or claims->>'role' is distinct from 'authenticated' or claims->>'aal' is distinct from 'aal2'
  or coalesce(claims->>'is_anonymous','false')<>'false' then
  raise exception using errcode='42501',message='PERMISSION_DENIED';
 end if;
 begin session:=private.flexexa_input_uuid(claims,'session_id');
 exception when others then raise exception using errcode='42501',message='PERMISSION_DENIED'; end;
 perform 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=actor and s.id=session and u.deleted_at is null and u.is_anonymous=false
   and (u.banned_until is null or u.banned_until<=at) and (s.not_after is null or s.not_after>at)
  for share of u,s;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 perform private.flexexa_assert_permission(p_tenant_id,'api_clients.manage');
end $$;
revoke all on function private.flexexa_assert_identity_administrator(uuid) from public,anon,authenticated;

create function private.flexexa_normalize_identity_administration(kind text,p jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare allowed text[]; n jsonb; environment text;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>4096 then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 environment:=p->>'environment';
 if jsonb_typeof(p->'environment') is distinct from 'string' or environment not in ('sandbox','production') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if kind='enroll' then
  allowed:=array['api_client_id','auth_user_id','environment'];
  n:=jsonb_build_object('api_client_id',private.flexexa_input_uuid(p,'api_client_id'),
   'auth_user_id',private.flexexa_input_uuid(p,'auth_user_id'),'environment',environment);
 elsif kind='revoke' then
  allowed:=array['principal_id','environment','reason_code'];
  if jsonb_typeof(p->'reason_code') is distinct from 'string' or p->>'reason_code' not in ('security','rotation','administrative') then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('principal_id',private.flexexa_input_uuid(p,'principal_id'),
   'environment',environment,'reason_code',p->>'reason_code');
 else raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if exists(select 1 from jsonb_object_keys(p) k where not(k=any(allowed))) then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return n;
end $$;
revoke all on function private.flexexa_normalize_identity_administration(text,jsonb) from public,anon,authenticated;

create function private.flexexa_administer_api_identity(kind text,p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); n jsonb; op text; h text; receipt uuid; prior public.idempotency_records%rowtype;
 resource uuid; target uuid; client uuid; account public.api_clients%rowtype; subject auth.users%rowtype;
 binding private.flexexa_machine_principals%rowtype; response jsonb; audit uuid; org uuid; outcome text;
begin
 -- A live MFA-authenticated administrator and current tenant permission are required even on replay.
 perform private.flexexa_assert_identity_administrator(p_tenant_id);
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_tenant_id),'id');
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 if p_idempotency_key is null or p_idempotency_key ~ '[^A-Za-z0-9_.:-]' or
  p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 n:=private.flexexa_normalize_identity_administration(kind,p_payload); op:=kind||'_api_client_identity';
 h:=encode(extensions.digest(n::text,'sha256'),'hex');
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
  values(p_tenant_id,'user',actor,op,p_idempotency_key,h,p_correlation_id)
  on conflict(tenant_id,actor_type,actor_id,operation_key,idempotency_key) do nothing returning id into receipt;
 if receipt is null then
  select * into prior from public.idempotency_records where tenant_id=p_tenant_id and actor_type='user' and actor_id=actor
   and operation_key=op and idempotency_key=p_idempotency_key for update;
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status<>'completed' or prior.response_json is null then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 if kind='enroll' then
  target:=(n->>'auth_user_id')::uuid; client:=(n->>'api_client_id')::uuid;
 else
  select * into binding from private.flexexa_machine_principals where id=(n->>'principal_id')::uuid
   and tenant_id=p_tenant_id and principal_type='api_client' and environment=n->>'environment';
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  target:=binding.auth_user_id; client:=binding.api_client_id;
 end if;
 -- Lock order: administrator/session, receipt, target Auth user, canonical client, binding.
 if target=actor then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 select * into subject from auth.users where id=target for update;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 select * into account from public.api_clients where tenant_id=p_tenant_id and id=client for share;
 if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
 if kind='enroll' then
  if account.status<>'active' or account.client_type not in ('confidential','api_key') or account.expires_at is null
   or not isfinite(account.expires_at) or account.expires_at<=statement_timestamp() then
   raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  -- This attestation is set by the trusted Auth provisioning service, never user_metadata or request JSON.
  if subject.raw_app_meta_data->'flexexa_machine_enrollment' is distinct from jsonb_build_object(
    'version',1,'tenant_id',p_tenant_id,'api_client_id',client,'environment',n->>'environment')
   or subject.is_anonymous is distinct from false or subject.deleted_at is not null or coalesce(subject.is_super_admin,false)
   or (subject.banned_until is not null and subject.banned_until>statement_timestamp())
   or exists(select 1 from public.memberships where user_id=target)
   or exists(select 1 from public.platform_memberships where user_id=target)
   or exists(select 1 from auth.sessions where user_id=target) then
   raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
  if exists(select 1 from private.flexexa_machine_principals where auth_user_id=target) then
   raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  insert into private.flexexa_machine_principals(auth_user_id,principal_type,tenant_id,api_client_id,environment,valid_from,valid_until)
   values(target,'api_client',p_tenant_id,client,n->>'environment',statement_timestamp(),account.expires_at) returning id into resource;
  outcome:='enrolled';
 else
  select * into binding from private.flexexa_machine_principals where id=(n->>'principal_id')::uuid
   and tenant_id=p_tenant_id and principal_type='api_client' and environment=n->>'environment' for update;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if binding.status='revoked' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  resource:=binding.id;
  update private.flexexa_machine_principals set status='revoked' where id=resource;
  outcome:='revoked';
 end if;
 select organization_id into org from public.tenants where id=p_tenant_id;
 response:=jsonb_build_object('tenant_id',p_tenant_id,'resource_type','machine_principal','resource_id',resource,
  'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'environment',n->>'environment','status',outcome);
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
  values(p_tenant_id,'user',actor,op,'machine_principal',resource,p_correlation_id,receipt,
   jsonb_strip_nulls(jsonb_build_object('schema_version',1,'api_client_id',client,'environment',n->>'environment','reason_code',n->>'reason_code'))) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
  values(p_tenant_id,org,audit,'flexexa.api_client_identity.'||outcome,p_correlation_id,'flexexa.identity',
   jsonb_build_object('resource_id',resource,'api_client_id',client,'environment',n->>'environment'));
 update public.idempotency_records set status='completed',response_reference=resource,response_json=response where id=receipt and tenant_id=p_tenant_id;
 return response;
exception when unique_violation or foreign_key_violation or check_violation or numeric_value_out_of_range then
 raise exception using errcode='P0001',message='VALIDATION_ERROR';
end $$;
revoke all on function private.flexexa_administer_api_identity(text,uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.flexexa_administer_api_identity(text,uuid,jsonb,text,uuid) to authenticated;
create function public.flexexa_enroll_api_client_identity(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_administer_api_identity('enroll',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)
$$;
create function public.flexexa_revoke_api_client_identity(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_administer_api_identity('revoke',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)
$$;
revoke all on function public.flexexa_enroll_api_client_identity(uuid,jsonb,text,uuid),public.flexexa_revoke_api_client_identity(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.flexexa_enroll_api_client_identity(uuid,jsonb,text,uuid),public.flexexa_revoke_api_client_identity(uuid,jsonb,text,uuid) to authenticated;
