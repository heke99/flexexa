-- Atomic core writes; no device commands, external requests or control permission.
-- The tables below are transactional evidence, not a second canonical customer store.
create table public.idempotency_records (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 actor_type text not null check(actor_type in ('user','service')),
 actor_id uuid not null,
 operation_key text not null,
 idempotency_key text not null check(idempotency_key !~ '[^A-Za-z0-9_.:-]' and idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$'),
 request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
 response_reference uuid,
 response_json jsonb,
 status text not null default 'started' check(status in ('started','completed')),
 correlation_id uuid not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz,
 unique(tenant_id,id),
 unique(tenant_id,actor_type,actor_id,operation_key,idempotency_key),
 check((status='started' and response_json is null and response_reference is null) or
       (status='completed' and response_json is not null and jsonb_typeof(response_json)='object' and response_reference is not null))
);
comment on table public.idempotency_records is 'Receipts remain authoritative even after expires_at; no automatic reuse. Failed transactions leave no receipt. Actor IDs deliberately survive user deletion.';
create table public.audit_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 actor_type text not null check(actor_type in ('user','service')),
 actor_id uuid not null,
 action text not null, resource_type text not null, resource_id uuid not null,
 occurred_at timestamptz not null default now(),
 ip inet, user_agent text,
 correlation_id uuid not null,
 idempotency_record_id uuid not null,
 metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json)='object'),
 unique(tenant_id,id),
 unique(tenant_id,idempotency_record_id),
 foreign key(tenant_id,idempotency_record_id) references public.idempotency_records(tenant_id,id) on delete restrict
);
alter table public.tenants add constraint tenants_id_organization_unique unique(id,organization_id);
create table public.outbox_events (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 organization_id uuid not null references public.organizations(id) on delete restrict,
 audit_event_id uuid not null,
 event_type text not null,
 event_version integer not null default 1 check(event_version>0),
 occurred_at timestamptz not null default now(),
 received_at timestamptz not null default now(),
 correlation_id uuid not null,
 causation_id uuid,
 source text not null,
 payload_json jsonb not null check(jsonb_typeof(payload_json)='object'),
 status text not null default 'pending' check(status in ('pending','published','dead_letter')),
 attempt_count integer not null default 0 check(attempt_count>=0),
 available_at timestamptz not null default now(),
 published_at timestamptz,
 unique(tenant_id,id),
 unique(tenant_id,audit_event_id),
 foreign key(tenant_id,audit_event_id) references public.audit_events(tenant_id,id) on delete restrict,
 foreign key(tenant_id,organization_id) references public.tenants(id,organization_id) on delete restrict,
 check((status='published')=(published_at is not null))
);
create index audit_events_tenant_time_idx on public.audit_events(tenant_id,occurred_at desc,id);
create index audit_events_resource_idx on public.audit_events(tenant_id,resource_type,resource_id,occurred_at);
create index audit_events_correlation_idx on public.audit_events(tenant_id,correlation_id);
create index outbox_pending_idx on public.outbox_events(tenant_id,available_at,id) where status='pending';
create index outbox_organization_idx on public.outbox_events(organization_id);
create index idempotency_actor_idx on public.idempotency_records(actor_id);

alter table public.idempotency_records enable row level security;
alter table public.audit_events enable row level security;
alter table public.outbox_events enable row level security;
revoke all on public.idempotency_records,public.audit_events,public.outbox_events from public,anon,authenticated;
grant select on public.audit_events to authenticated;
create policy audit_events_authorized_read on public.audit_events for select to authenticated
 using(private.flexexa_has_permission(tenant_id,'audit.read'));
-- Receipts/outbox have no browser policies or grants. Service delivery is a separate scoped boundary.
create function private.flexexa_deny_audit_mutation() returns trigger
language plpgsql set search_path='' as $$ begin
 raise exception using errcode='23514',message='AUDIT_IMMUTABLE';
end $$;
create trigger audit_events_append_only before update or delete on public.audit_events
 for each row execute function private.flexexa_deny_audit_mutation();
create trigger tenant_id_immutable before update on public.idempotency_records
 for each row execute function private.flexexa_immutable_tenant_id();
create trigger tenant_id_immutable before update on public.outbox_events
 for each row execute function private.flexexa_immutable_tenant_id();

create function private.flexexa_protect_outbox_fact() returns trigger
language plpgsql set search_path='' as $$ begin
 if (to_jsonb(new)-array['status','attempt_count','available_at','published_at']) is distinct from
    (to_jsonb(old)-array['status','attempt_count','available_at','published_at']) then
  raise exception using errcode='23514',message='OUTBOX_FACT_IMMUTABLE';
 end if;
 if old.status<>'pending' and to_jsonb(new) is distinct from to_jsonb(old) then
  raise exception using errcode='23514',message='OUTBOX_TERMINAL';
 end if;
 return new;
end $$;
create trigger outbox_fact_immutable before update on public.outbox_events
 for each row execute function private.flexexa_protect_outbox_fact();
revoke all on function private.flexexa_protect_outbox_fact() from public,anon,authenticated;

create function private.flexexa_protect_receipt() returns trigger
language plpgsql set search_path='' as $$ begin
 if (to_jsonb(new)-array['status','response_reference','response_json','expires_at']) is distinct from
    (to_jsonb(old)-array['status','response_reference','response_json','expires_at']) or
    (old.status='completed' and (to_jsonb(new)-'expires_at') is distinct from (to_jsonb(old)-'expires_at')) then
  raise exception using errcode='23514',message='IDEMPOTENCY_RECEIPT_IMMUTABLE';
 end if;
 return new;
end $$;
create trigger idempotency_receipt_immutable before update on public.idempotency_records
 for each row execute function private.flexexa_protect_receipt();
revoke all on function private.flexexa_protect_receipt() from public,anon,authenticated;

-- Mirrors @flexexa/domain text(): Unicode scalar length, ASCII-control rejection,
-- ECMAScript whitespace trim; UUIDs/enums/numeric strings have stricter parsers.
create function private.flexexa_input_text(p jsonb,k text,required boolean default false,max_length integer default 200)
returns text language plpgsql immutable set search_path='' as $$
declare v text; begin
 if p->k is null or p->k='null'::jsonb then
  if required then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  return null;
 end if;
 if jsonb_typeof(p->k)<>'string' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 v:=p->>k;
 if length(v)>max_length or v ~ ('['||chr(1)||'-'||chr(31)||chr(127)||']') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end if;
 v:=btrim(v,U&' \00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF');
 if v='' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return v;
end $$;
create function private.flexexa_input_uuid(p jsonb,k text,required boolean default true)
returns uuid language plpgsql immutable set search_path='' as $$
declare v text; begin
 if not required and (p->k is null or p->k='null'::jsonb) then return null; end if;
 v:=p->>k;
 if jsonb_typeof(p->k) is distinct from 'string' or length(v)<>36 or v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end if;
 return v::uuid;
end $$;
create function private.flexexa_input_power(p jsonb,k text,whole_digits integer)
returns text language plpgsql immutable set search_path='' as $$
declare v text; begin
 if p->k is null or p->k='null'::jsonb then return null; end if;
 v:=p->>k;
 if jsonb_typeof(p->k)<>'string' or v ~ '[^0-9.]' or v !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,3})?$' or length(split_part(v,'.',1))>whole_digits then
  raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end if;
 return trim_scale(v::numeric)::text;
end $$;
create function private.flexexa_normalize_core_input(kind text,p jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare allowed text[]; n jsonb; v text; resolution numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16384 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 case kind
 when 'customer' then
  allowed:=array['customer_type','display_name','external_customer_id'];
  if jsonb_typeof(p->'customer_type') is distinct from 'string' or p->>'customer_type' not in ('person','company') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('customer_type',p->>'customer_type','display_name',private.flexexa_input_text(p,'display_name',true),
     'external_customer_id',private.flexexa_input_text(p,'external_customer_id'));
 when 'site' then
  allowed:=array['customer_id','name','external_site_id','country_code','timezone'];
  v:=case when p?'country_code' then p->>'country_code' else 'SE' end;
  if v is null or length(v)<>2 or v !~ '^[A-Z]{2}$' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('customer_id',private.flexexa_input_uuid(p,'customer_id'),'name',private.flexexa_input_text(p,'name',true),
    'external_site_id',private.flexexa_input_text(p,'external_site_id'),'country_code',v,
    'timezone',case when p?'timezone' then private.flexexa_input_text(p,'timezone',true,100) else 'Europe/Stockholm' end);
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=n->>'timezone') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 when 'metering_point' then
  allowed:=array['site_id','external_metering_point_id','metering_point_type','measurement_resolution_minutes','market_area_id'];
  v:=case when p?'metering_point_type' then p->>'metering_point_type' else 'consumption' end;
  if v is null or v not in ('consumption','production','bidirectional') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  if p?'measurement_resolution_minutes' then
   if jsonb_typeof(p->'measurement_resolution_minutes') is distinct from 'number' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   resolution:=(p->>'measurement_resolution_minutes')::numeric;
   if resolution<>trunc(resolution) or resolution<1 or resolution>1440 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  else resolution:=15; end if;
  n:=jsonb_build_object('site_id',private.flexexa_input_uuid(p,'site_id'),
    'external_metering_point_id',private.flexexa_input_text(p,'external_metering_point_id',true),
    'metering_point_type',v,'measurement_resolution_minutes',resolution::integer,
    'market_area_id',private.flexexa_input_uuid(p,'market_area_id',false));
 when 'asset' then
  allowed:=array['customer_id','site_id','asset_type','display_name','external_id','manufacturer','model','rated_power_kw','energy_capacity_kwh'];
  v:=p->>'asset_type';
  if jsonb_typeof(p->'asset_type') is distinct from 'string' or v not in ('ev','evse','battery','solar_inverter','meter','heat_pump','hems','hvac','industrial_load','generator','other_der','other_flexible_load') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('customer_id',private.flexexa_input_uuid(p,'customer_id'),'site_id',private.flexexa_input_uuid(p,'site_id'),
    'asset_type',v,'display_name',private.flexexa_input_text(p,'display_name',true),'external_id',private.flexexa_input_text(p,'external_id'),
    'manufacturer',private.flexexa_input_text(p,'manufacturer'),'model',private.flexexa_input_text(p,'model'),
    'rated_power_kw',private.flexexa_input_power(p,'rated_power_kw',9),'energy_capacity_kwh',private.flexexa_input_power(p,'energy_capacity_kwh',11));
 else raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end case;
 if exists(select 1 from jsonb_object_keys(p) k where not k=any(allowed)) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return n;
end $$;

-- Four whitelisted ordinary core creations share one atomic authorization/receipt boundary.
-- Private RPC remains fully authorized even when called directly, not only through a wrapper.
create function private.flexexa_create_core_entity(kind text,p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); permission text; operation text; n jsonb; h text; receipt uuid;
 prior public.idempotency_records%rowtype; resource uuid; audit uuid; response jsonb; org uuid;
 parent_status text; parent_customer uuid;
begin
 permission:=case kind when 'customer' then 'customers.write' when 'site' then 'sites.write'
  when 'metering_point' then 'metering_points.write' when 'asset' then 'assets.write' else null end;
 if actor is null or permission is null or p_tenant_id is null then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 perform private.flexexa_assert_permission(p_tenant_id,permission);
 if p_correlation_id is null or p_idempotency_key is null or p_idempotency_key ~ '[^A-Za-z0-9_.:-]' or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 -- Align strict UUID version/variant conventions even though Postgres accepts other UUID spellings.
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_tenant_id),'id');
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 n:=private.flexexa_normalize_core_input(kind,p_payload);
 h:=encode(extensions.digest(n::text,'sha256'),'hex'); operation:='create_'||kind;
 insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
 values(p_tenant_id,'user',actor,operation,p_idempotency_key,h,p_correlation_id)
 on conflict(tenant_id,actor_type,actor_id,operation_key,idempotency_key) do nothing returning id into receipt;
 if receipt is null then
  -- A separate statement after ON CONFLICT observes the winner at READ COMMITTED.
  select * into prior from public.idempotency_records where tenant_id=p_tenant_id and actor_type='user' and actor_id=actor and operation_key=operation and idempotency_key=p_idempotency_key for update;
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status<>'completed' or prior.response_json is null then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 select t.organization_id into org from public.tenants t where t.id=p_tenant_id;
 case kind
 when 'customer' then
  insert into public.customers(tenant_id,customer_type,display_name,external_customer_id)
  values(p_tenant_id,n->>'customer_type',n->>'display_name',n->>'external_customer_id') returning id into resource;
 when 'site' then
  select status into parent_status from public.customers where tenant_id=p_tenant_id and id=(n->>'customer_id')::uuid for share;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if parent_status<>'active' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=n->>'timezone') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  insert into public.sites(tenant_id,customer_id,name,external_site_id,country_code,timezone)
  values(p_tenant_id,(n->>'customer_id')::uuid,n->>'name',n->>'external_site_id',n->>'country_code',n->>'timezone') returning id into resource;
 when 'metering_point' then
  select s.status,s.customer_id into parent_status,parent_customer from public.sites s where s.tenant_id=p_tenant_id and s.id=(n->>'site_id')::uuid for share;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if parent_status<>'active' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  perform 1 from public.customers where tenant_id=p_tenant_id and id=parent_customer and status='active' for share;
  if not found then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  if n->>'market_area_id' is not null and not exists(select 1 from public.market_areas where id=(n->>'market_area_id')::uuid) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  insert into public.metering_points(tenant_id,site_id,external_metering_point_id,metering_point_type,measurement_resolution_minutes,market_area_id,import_enabled,export_enabled)
  values(p_tenant_id,(n->>'site_id')::uuid,n->>'external_metering_point_id',n->>'metering_point_type',(n->>'measurement_resolution_minutes')::integer,(n->>'market_area_id')::uuid,
   n->>'metering_point_type'<>'production',n->>'metering_point_type'<>'consumption') returning id into resource;
 when 'asset' then
  select status into parent_status from public.customers where tenant_id=p_tenant_id and id=(n->>'customer_id')::uuid for share;
  if not found then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if parent_status<>'active' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  select s.status,s.customer_id into parent_status,parent_customer from public.sites s where s.tenant_id=p_tenant_id and s.id=(n->>'site_id')::uuid for share;
  if not found or parent_customer<>(n->>'customer_id')::uuid then raise exception using errcode='P0001',message='TENANT_MISMATCH'; end if;
  if parent_status<>'active' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  insert into public.assets(tenant_id,customer_id,site_id,asset_type,display_name,external_id,manufacturer,model,rated_power_kw,energy_capacity_kwh,controllable)
  values(p_tenant_id,(n->>'customer_id')::uuid,(n->>'site_id')::uuid,n->>'asset_type',n->>'display_name',n->>'external_id',n->>'manufacturer',n->>'model',(n->>'rated_power_kw')::numeric,(n->>'energy_capacity_kwh')::numeric,false) returning id into resource;
 end case;
 response:=jsonb_build_object('tenant_id',p_tenant_id,'resource_type',kind,'resource_id',resource,'correlation_id',p_correlation_id,'idempotency_key',p_idempotency_key,'status','created');
 insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
 values(p_tenant_id,'user',actor,operation,kind,resource,p_correlation_id,receipt,jsonb_build_object('schema_version',1)) returning id into audit;
 insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
 values(p_tenant_id,org,audit,'flexexa.'||kind||'.created',p_correlation_id,'flexexa.core',jsonb_build_object('resource_type',kind,'resource_id',resource));
 update public.idempotency_records set status='completed',response_reference=resource,response_json=response where id=receipt and tenant_id=p_tenant_id;
 return response;
exception when unique_violation or foreign_key_violation or check_violation or numeric_value_out_of_range then
 -- No raw table/constraint names, customer PII or privileged SQL details returned.
 raise exception using errcode='P0001',message='VALIDATION_ERROR';
end $$;
create function public.flexexa_create_customer(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$ select private.flexexa_create_core_entity('customer',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id) $$;
create function public.flexexa_create_site(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$ select private.flexexa_create_core_entity('site',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id) $$;
create function public.flexexa_create_metering_point(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$ select private.flexexa_create_core_entity('metering_point',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id) $$;
create function public.flexexa_create_asset(p_tenant_id uuid,p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$ select private.flexexa_create_core_entity('asset',p_tenant_id,p_payload,p_idempotency_key,p_correlation_id) $$;
revoke all on function private.flexexa_deny_audit_mutation(),private.flexexa_input_text(jsonb,text,boolean,integer),private.flexexa_input_uuid(jsonb,text,boolean),private.flexexa_input_power(jsonb,text,integer),private.flexexa_normalize_core_input(text,jsonb),private.flexexa_create_core_entity(text,uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function private.flexexa_create_core_entity(text,uuid,jsonb,text,uuid) to authenticated;
revoke all on function public.flexexa_create_customer(uuid,jsonb,text,uuid),public.flexexa_create_site(uuid,jsonb,text,uuid),public.flexexa_create_metering_point(uuid,jsonb,text,uuid),public.flexexa_create_asset(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.flexexa_create_customer(uuid,jsonb,text,uuid),public.flexexa_create_site(uuid,jsonb,text,uuid),public.flexexa_create_metering_point(uuid,jsonb,text,uuid),public.flexexa_create_asset(uuid,jsonb,text,uuid) to authenticated;
