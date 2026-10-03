-- Attested, exact-scope customer consent. No OAuth, inherited scope or control authority.
insert into public.permissions(permission_key,description,domain,action,scope_type,risk_level,requires_mfa)
values ('consents.read','Read scoped customer consent status','consents','read','tenant','normal',false),
 ('consents.manage','Record attested customer consent and revocation','consents','manage','tenant','high',true);
insert into public.role_template_permissions(role_template_id,permission_id)
select t.id,p.id from public.role_templates t cross join public.permissions p
where (t.role_key='tenant_admin' and p.permission_key in ('consents.read','consents.manage'))
 or (t.role_key in ('operator','support','viewer') and p.permission_key='consents.read');
-- Extend only system roles backed by the named templates. Custom roles keep their grants.
insert into public.role_permissions(tenant_id,role_id,permission_id)
select r.tenant_id,r.id,p.id from public.roles r join public.role_templates t on t.id=r.role_template_id
join public.role_template_permissions tp on tp.role_template_id=t.id
join public.permissions p on p.id=tp.permission_id
where r.scope_type='tenant' and r.is_system_role and p.permission_key in ('consents.read','consents.manage');

alter table public.assets add constraint assets_consent_owner_key unique(tenant_id,id,site_id,customer_id);
create table public.consents (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 customer_id uuid not null, site_id uuid, asset_id uuid,
 environment text not null check(environment in ('sandbox','production')),
 consent_type text not null check(consent_type in ('smart_charging','remote_control','flex_participation','data_sharing','vehicle_api','location','market_participation')),
 scope_type text generated always as (case when asset_id is not null then 'asset' when site_id is not null then 'site' else 'customer' end) stored,
 policy_version text not null check(length(policy_version)<=128 and policy_version !~ '[^A-Za-z0-9_.:-]' and policy_version ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$'),
 status text not null default 'granted' check(status in ('granted','revoked')),
 granted_at timestamptz not null default clock_timestamp(), valid_until timestamptz not null,
 granted_by uuid not null references auth.users(id) on delete restrict,
 source text not null check(source in ('customer_portal','signed_document','support_verified')),
 evidence_json jsonb not null check(jsonb_typeof(evidence_json)='object' and
  evidence_json ?& array['reference','sha256'] and evidence_json-array['reference','sha256']='{}'::jsonb and
  jsonb_typeof(evidence_json->'reference')='string' and length(evidence_json->>'reference')<=128 and
  evidence_json->>'reference' !~ '[^A-Za-z0-9_.:-]' and evidence_json->>'reference' ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' and
  jsonb_typeof(evidence_json->'sha256')='string' and length(evidence_json->>'sha256')=64 and evidence_json->>'sha256' !~ '[^a-f0-9]'),
 revoked_at timestamptz, revoked_by uuid references auth.users(id) on delete restrict,
 revocation_reason text check(revocation_reason in ('customer_request','security','administrative')),
 unique(tenant_id,id),
 check(asset_id is null or site_id is not null),
 check(isfinite(granted_at) and isfinite(valid_until) and valid_until>granted_at),
 check((status='granted' and revoked_at is null and revoked_by is null and revocation_reason is null) or
  (status='revoked' and revoked_at is not null and isfinite(revoked_at) and revoked_at>=granted_at and revoked_by is not null and revocation_reason is not null)),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id) on delete restrict,
 foreign key(tenant_id,site_id,customer_id) references public.sites(tenant_id,id,customer_id) on delete restrict,
 foreign key(tenant_id,asset_id,site_id,customer_id) references public.assets(tenant_id,id,site_id,customer_id) on delete restrict,
 constraint consent_no_active_overlap exclude using gist
  (tenant_id with =,customer_id with =,scope_type with =,(coalesce(asset_id,site_id,customer_id)) with =,
   environment with =,consent_type with =,tstzrange(granted_at,valid_until,'[)') with &&) where(status='granted')
);
create index consents_customer_history_idx on public.consents(tenant_id,customer_id,granted_at,id);
create index consents_site_idx on public.consents(tenant_id,site_id,customer_id) where site_id is not null;
create index consents_asset_idx on public.consents(tenant_id,asset_id,site_id,customer_id) where asset_id is not null;
create index consents_granted_by_idx on public.consents(granted_by);
create index consents_revoked_by_idx on public.consents(revoked_by) where revoked_by is not null;
create function private.flexexa_preserve_consent() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception using errcode='23514',message='CONSENT_HISTORY_IMMUTABLE'; end if;
 if (to_jsonb(new)-array['status','revoked_at','revoked_by','revocation_reason']) is distinct from
    (to_jsonb(old)-array['status','revoked_at','revoked_by','revocation_reason']) or old.status<>'granted' or new.status<>'revoked' then
  raise exception using errcode='23514',message='CONSENT_HISTORY_IMMUTABLE';
 end if;
 return new;
end $$;
revoke all on function private.flexexa_preserve_consent() from public,anon,authenticated;
create trigger consent_history_immutable before update or delete on public.consents for each row execute function private.flexexa_preserve_consent();
alter table public.consents enable row level security;
revoke all on public.consents from public,anon,authenticated;
-- No documents, actor identities or evidence references in ordinary tenant reads.
grant select(id,tenant_id,customer_id,site_id,asset_id,environment,consent_type,scope_type,policy_version,status,granted_at,valid_until,revoked_at,revocation_reason) on public.consents to authenticated;
create policy consents_authorized_read on public.consents for select to authenticated
 using(private.flexexa_has_permission(tenant_id,'consents.read'));

create function private.flexexa_normalize_consent_input(kind text,p jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare allowed text[]; n jsonb; site uuid; asset uuid; expiry timestamptz;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16384 or kind is null or kind not in ('grant','revoke','check') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if jsonb_typeof(p->'environment') is distinct from 'string' or p->>'environment' not in ('sandbox','production') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if kind='revoke' then
  allowed:=array['consent_id','environment','reason_code'];
  if jsonb_typeof(p->'reason_code') is distinct from 'string' or p->>'reason_code' not in ('customer_request','security','administrative') then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('consent_id',private.flexexa_input_uuid(p,'consent_id'),'environment',p->>'environment','reason_code',p->>'reason_code');
 else
  allowed:=array['customer_id','site_id','asset_id','environment','consent_type','policy_version'];
  if not(p ?& array['site_id','asset_id']) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  if p->'site_id'<>'null'::jsonb then site:=private.flexexa_input_uuid(p,'site_id'); end if;
  if p->'asset_id'<>'null'::jsonb then asset:=private.flexexa_input_uuid(p,'asset_id'); end if;
  if (asset is not null and site is null) or jsonb_typeof(p->'consent_type') is distinct from 'string' or
   p->>'consent_type' not in ('smart_charging','remote_control','flex_participation','data_sharing','vehicle_api','location','market_participation') or
   jsonb_typeof(p->'policy_version') is distinct from 'string' or length(p->>'policy_version')>128 or
   p->>'policy_version' ~ '[^A-Za-z0-9_.:-]' or p->>'policy_version' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('customer_id',private.flexexa_input_uuid(p,'customer_id'),'site_id',site,'asset_id',asset,
   'environment',p->>'environment','consent_type',p->>'consent_type','policy_version',p->>'policy_version');
  if kind='check' then
   allowed:=allowed||array['consent_id']; n:=n||jsonb_build_object('consent_id',private.flexexa_input_uuid(p,'consent_id'));
  else
   allowed:=allowed||array['valid_until','source','evidence_reference','evidence_sha256'];
   expiry:=private.flexexa_policy_instant(p,'valid_until');
   if jsonb_typeof(p->'source') is distinct from 'string' or p->>'source' not in ('customer_portal','signed_document','support_verified') or
    jsonb_typeof(p->'evidence_reference') is distinct from 'string' or length(p->>'evidence_reference')>128 or
    p->>'evidence_reference' ~ '[^A-Za-z0-9_.:-]' or p->>'evidence_reference' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]*$' or
    jsonb_typeof(p->'evidence_sha256') is distinct from 'string' or length(p->>'evidence_sha256')<>64 or p->>'evidence_sha256' ~ '[^a-f0-9]' then
    raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   n:=n||jsonb_build_object('valid_until',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'source',p->>'source','evidence_reference',p->>'evidence_reference','evidence_sha256',p->>'evidence_sha256');
  end if;
 end if;
 if exists(select 1 from jsonb_object_keys(p) k where not(k=any(allowed))) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return n;
end $$;
-- Parent locks use the same order in granting and checking. Revocation remains
-- possible even after archival; a new grant/check requires active exact ownership.
create function private.flexexa_consent_owner_active(p_tenant uuid,n jsonb)
returns boolean language plpgsql volatile set search_path='' as $$
declare current_status text;
begin
 select status into current_status from public.customers where tenant_id=p_tenant and id=(n->>'customer_id')::uuid for share;
 if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
 if current_status<>'active' then return false; end if;
 if n->>'site_id' is not null then
  select status into current_status from public.sites where tenant_id=p_tenant and id=(n->>'site_id')::uuid and customer_id=(n->>'customer_id')::uuid for share;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if current_status<>'active' then return false; end if;
 end if;
 if n->>'asset_id' is not null then
  select status into current_status from public.assets where tenant_id=p_tenant and id=(n->>'asset_id')::uuid
   and customer_id=(n->>'customer_id')::uuid and site_id=(n->>'site_id')::uuid for share;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if current_status<>'active' then return false; end if;
 end if;
 return true;
end $$;
create function private.flexexa_mutate_consent(kind text,p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); n jsonb; operation text; h text; receipt uuid; prior public.idempotency_records%rowtype;
 resource uuid; selected public.consents%rowtype; at timestamptz; response jsonb; audit uuid; org uuid; outcome text;
begin
 if actor is null or p_tenant_id is null or kind is null or kind not in ('grant','revoke') then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 perform private.flexexa_assert_permission(p_tenant_id,'consents.manage');
 if p_correlation_id is null or p_idempotency_key is null or p_idempotency_key ~ '[^A-Za-z0-9_.:-]' or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_tenant_id),'id');
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 n:=private.flexexa_normalize_consent_input(kind,p_payload); operation:=kind||'_consent'; h:=encode(extensions.digest(n::text,'sha256'),'hex');
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
 values(p_tenant_id,'user',actor,operation,p_idempotency_key,h,p_correlation_id)
 on conflict(tenant_id,actor_type,actor_id,operation_key,idempotency_key) do nothing returning id into receipt;
 if receipt is null then
  select * into prior from public.idempotency_records where tenant_id=p_tenant_id and actor_type='user' and actor_id=actor
   and operation_key=operation and idempotency_key=p_idempotency_key for update;
  perform private.flexexa_assert_permission(p_tenant_id,'consents.manage');
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status<>'completed' or prior.response_json is null then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 if kind='grant' then
  if not private.flexexa_consent_owner_active(p_tenant_id,n) then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  at:=clock_timestamp();
  if (n->>'valid_until')::timestamptz<=at then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  perform private.flexexa_assert_permission(p_tenant_id,'consents.manage');
  insert into public.consents(tenant_id,customer_id,site_id,asset_id,environment,consent_type,policy_version,granted_at,valid_until,granted_by,source,evidence_json)
  values(p_tenant_id,(n->>'customer_id')::uuid,(n->>'site_id')::uuid,(n->>'asset_id')::uuid,n->>'environment',n->>'consent_type',n->>'policy_version',at,
   (n->>'valid_until')::timestamptz,actor,n->>'source',jsonb_build_object('reference',n->>'evidence_reference','sha256',n->>'evidence_sha256')) returning id into resource;
  outcome:='granted';
 else
  resource:=(n->>'consent_id')::uuid;
  select * into selected from public.consents where tenant_id=p_tenant_id and id=resource and environment=n->>'environment' for update;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  perform private.flexexa_assert_permission(p_tenant_id,'consents.manage');
  if selected.status<>'granted' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  update public.consents set status='revoked',revoked_at=clock_timestamp(),revoked_by=actor,revocation_reason=n->>'reason_code' where tenant_id=p_tenant_id and id=resource;
  outcome:='revoked';
 end if;
 response:=jsonb_build_object('tenant_id',p_tenant_id,'resource_type','consent','resource_id',resource,'environment',n->>'environment',
  'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'status',outcome);
 select organization_id into org from public.tenants where id=p_tenant_id;
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
 values(p_tenant_id,'user',actor,operation,'consent',resource,p_correlation_id,receipt,
  jsonb_strip_nulls(jsonb_build_object('schema_version',1,'environment',n->>'environment','reason_code',n->>'reason_code'))) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
 values(p_tenant_id,org,audit,'flexexa.consent.'||outcome,p_correlation_id,'flexexa.consents',jsonb_build_object('resource_type','consent','resource_id',resource,'environment',n->>'environment'));
 update public.idempotency_records set status='completed',response_reference=resource,response_json=response where id=receipt and tenant_id=p_tenant_id;
 return response;
exception when exclusion_violation then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION';
 when unique_violation or foreign_key_violation or check_violation then raise exception using errcode='P0001',message='VALIDATION_ERROR';
end $$;
create function private.flexexa_check_consent(p_tenant_id uuid,p_payload jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare n jsonb; selected public.consents%rowtype; valid boolean:=false; owner_active boolean; at timestamptz;
begin
 if auth.uid() is null or p_tenant_id is null then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 perform private.flexexa_assert_permission(p_tenant_id,'consents.read');
 n:=private.flexexa_normalize_consent_input('check',p_payload);
 owner_active:=private.flexexa_consent_owner_active(p_tenant_id,n);
 -- Pin the original consent ID. Regranting cannot resurrect old queued work.
 select * into selected from public.consents where tenant_id=p_tenant_id and id=(n->>'consent_id')::uuid and
  customer_id=(n->>'customer_id')::uuid and site_id is not distinct from (n->>'site_id')::uuid and
  asset_id is not distinct from (n->>'asset_id')::uuid and environment=n->>'environment' and
  consent_type=n->>'consent_type' and policy_version=n->>'policy_version' for share;
 at:=clock_timestamp();
 valid:=found and owner_active and selected.status='granted' and selected.granted_at<=at and selected.valid_until>at;
 perform private.flexexa_assert_permission(p_tenant_id,'consents.read');
 return jsonb_build_object('tenant_id',p_tenant_id,'consent_id',n->>'consent_id','environment',n->>'environment','consent_type',n->>'consent_type',
  'policy_version',n->>'policy_version','valid',valid,'reason_code',case when valid then 'valid' else 'CONSENT_REQUIRED' end,
  'checked_at',to_char(at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end $$;
create function public.flexexa_grant_consent(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_mutate_consent('grant',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)$$;
create function public.flexexa_revoke_consent(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_mutate_consent('revoke',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id)$$;
create function public.flexexa_check_consent(p_tenant_id uuid,p_payload jsonb)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_check_consent(p_tenant_id,p_payload)$$;
revoke all on function private.flexexa_normalize_consent_input(text,jsonb),private.flexexa_consent_owner_active(uuid,jsonb),private.flexexa_mutate_consent(text,uuid,jsonb,text,uuid),private.flexexa_check_consent(uuid,jsonb) from public,anon,authenticated;
grant execute on function private.flexexa_mutate_consent(text,uuid,jsonb,text,uuid),private.flexexa_check_consent(uuid,jsonb) to authenticated;
revoke all on function public.flexexa_grant_consent(uuid,jsonb,text,uuid),public.flexexa_revoke_consent(uuid,jsonb,text,uuid),public.flexexa_check_consent(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.flexexa_grant_consent(uuid,jsonb,text,uuid),public.flexexa_revoke_consent(uuid,jsonb,text,uuid),public.flexexa_check_consent(uuid,jsonb) to authenticated;
comment on table public.consents is 'Attested exact-scope consent evidence; neither customer signature verification nor physical/market authority. Revocation and expiry must be rechecked at dispatch.';
