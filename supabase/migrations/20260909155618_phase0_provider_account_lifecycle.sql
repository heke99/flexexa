-- Narrow, authenticated inventory transactions. No provider HTTP, credentials or device commands.
create function private.flexexa_normalize_provider_account_input(kind text, p jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare allowed text[]; n jsonb; provider_key text; environment text; reason text;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16384 then
  raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end if;
 environment:=p->>'environment';
 if jsonb_typeof(p->'environment') is distinct from 'string' or environment not in ('sandbox','production') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end if;
 case kind
 when 'register' then
  allowed:=array['customer_id','provider_key','environment'];
  provider_key:=p->>'provider_key';
  if jsonb_typeof(p->'provider_key') is distinct from 'string' or length(provider_key)>80 or
   provider_key ~ '[^a-z0-9_]' or provider_key !~ '^[a-z][a-z0-9_]*$' then
   raise exception using errcode='P0001',message='VALIDATION_ERROR';
  end if;
  n:=jsonb_build_object('customer_id',private.flexexa_input_uuid(p,'customer_id'),'provider_key',provider_key,'environment',environment);
 when 'revoke' then
  allowed:=array['provider_account_id','environment','reason_code']; reason:=p->>'reason_code';
  if jsonb_typeof(p->'reason_code') is distinct from 'string' or reason not in ('customer_request','security','administrative') then
   raise exception using errcode='P0001',message='VALIDATION_ERROR';
  end if;
  n:=jsonb_build_object('provider_account_id',private.flexexa_input_uuid(p,'provider_account_id'),'environment',environment,'reason_code',reason);
 else raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end case;
 if exists(select 1 from jsonb_object_keys(p) k where not(k=any(allowed))) then
  raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end if;
 return n;
end $$;
create function private.flexexa_mutate_provider_account(kind text,p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); operation text; n jsonb; h text; receipt uuid;
 prior public.idempotency_records%rowtype; resource uuid; audit uuid; response jsonb; org uuid;
 parent_status text; selected_provider uuid; outcome text;
begin
 if actor is null or p_tenant_id is null or kind is null or kind not in ('register','revoke') then
  raise exception using errcode='42501',message='PERMISSION_DENIED';
 end if;
 -- Reauthorize before looking up a receipt, including after a membership is revoked.
 perform private.flexexa_assert_permission(p_tenant_id,'integrations.manage');
 if p_correlation_id is null or p_idempotency_key is null or p_idempotency_key ~ '[^A-Za-z0-9_.:-]' or
  p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end if;
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_tenant_id),'id');
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 n:=private.flexexa_normalize_provider_account_input(kind,p_payload);
 operation:=kind||'_provider_account'; h:=encode(extensions.digest(n::text,'sha256'),'hex');
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
 values(p_tenant_id,'user',actor,operation,p_idempotency_key,h,p_correlation_id)
 on conflict(tenant_id,actor_type,actor_id,operation_key,idempotency_key) do nothing returning id into receipt;
 if receipt is null then
  select * into prior from public.idempotency_records where tenant_id=p_tenant_id and actor_type='user' and actor_id=actor
   and operation_key=operation and idempotency_key=p_idempotency_key for update;
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status<>'completed' or prior.response_json is null then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 select organization_id into org from public.tenants where id=p_tenant_id;
 if kind='register' then
  select status into parent_status from public.customers where tenant_id=p_tenant_id and id=(n->>'customer_id')::uuid for share;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if parent_status<>'active' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  -- Suspended providers permit pending inventory ONLY; this does not enable connectivity.
  select id into selected_provider from public.integration_providers where key=n->>'provider_key' for share;
  if not found then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  insert into public.provider_accounts(tenant_id,customer_id,provider_id,environment,connection_status)
   values(p_tenant_id,(n->>'customer_id')::uuid,selected_provider,n->>'environment','pending') returning id into resource;
  outcome:='registered';
 else
  resource:=(n->>'provider_account_id')::uuid;
  select connection_status into parent_status from public.provider_accounts
   where tenant_id=p_tenant_id and id=resource and environment=n->>'environment' for update;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if parent_status='revoked' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  -- Local authority is revoked atomically. Do not rewrite connection history or claim upstream cleanup.
  update public.provider_accounts set connection_status='revoked' where tenant_id=p_tenant_id and id=resource;
  outcome:='revoked';
 end if;
 response:=jsonb_build_object('tenant_id',p_tenant_id,'resource_type','provider_account','resource_id',resource,
  'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'environment',n->>'environment','status',outcome);
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
 values(p_tenant_id,'user',actor,operation,'provider_account',resource,p_correlation_id,receipt,
  jsonb_strip_nulls(jsonb_build_object('schema_version',1,'environment',n->>'environment','reason_code',n->>'reason_code'))) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
 values(p_tenant_id,org,audit,'flexexa.provider_account.'||outcome,p_correlation_id,'flexexa.connect',
  jsonb_build_object('resource_type','provider_account','resource_id',resource,'environment',n->>'environment'));
 update public.idempotency_records set status='completed',response_reference=resource,response_json=response where id=receipt and tenant_id=p_tenant_id;
 return response;
exception when unique_violation or foreign_key_violation or check_violation or numeric_value_out_of_range then
 raise exception using errcode='P0001',message='VALIDATION_ERROR';
end $$;
create function public.flexexa_register_provider_account(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_mutate_provider_account('register',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)
$$;
create function public.flexexa_revoke_provider_account(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_mutate_provider_account('revoke',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)
$$;
revoke all on function private.flexexa_normalize_provider_account_input(text,jsonb),private.flexexa_mutate_provider_account(text,uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.flexexa_mutate_provider_account(text,uuid,jsonb,text,uuid) to authenticated;
revoke all on function public.flexexa_register_provider_account(uuid,jsonb,text,uuid),public.flexexa_revoke_provider_account(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.flexexa_register_provider_account(uuid,jsonb,text,uuid),public.flexexa_revoke_provider_account(uuid,jsonb,text,uuid) to authenticated;
