-- Provider-neutral inventory only. Registration is NOT consent, OAuth or control authority.
-- Use the existing canonical text parser so Unicode trimming/length rules cannot drift.
create function private.flexexa_connect_external_id_valid(p text) returns boolean
language plpgsql immutable set search_path='' as $$ begin
 if p is null then return true; end if;
 return p=private.flexexa_input_text(jsonb_build_object('v',p),'v',true,512);
exception when sqlstate 'P0001' then return false;
end $$;
create function private.flexexa_connect_time_valid(p timestamptz) returns boolean
language sql immutable set search_path='' as $$
 select p is null or (isfinite(p) and p>='0001-01-01 00:00:00+00'::timestamptz and p<'10000-01-01 00:00:00+00'::timestamptz)
$$;
revoke all on function private.flexexa_connect_external_id_valid(text),private.flexexa_connect_time_valid(timestamptz) from public,anon,authenticated;
create table public.integration_providers (
 id uuid primary key default gen_random_uuid(),
 key text not null unique check(key ~ '^[a-z][a-z0-9_]{0,79}$' and key !~ '[^a-z0-9_]'),
 name text not null check(length(btrim(name)) between 1 and 200),
 provider_type text not null check(provider_type in ('aggregator','direct_oem','ocpp','edge','meter','data','market')),
 status text not null default 'suspended' check(status in ('active','suspended')),
 supports_oauth boolean not null default false,
 supports_webhook boolean not null default false,
 supports_polling boolean not null default false,
 rate_limit_config_json jsonb not null default '{}' check(jsonb_typeof(rate_limit_config_json)='object'),
 capabilities_json jsonb not null default '[]' check(jsonb_typeof(capabilities_json)='array'),
 created_at timestamptz(3) not null default now(), updated_at timestamptz(3) not null default now()
);
-- Suspended catalog entries do not claim implemented/live connectivity.
insert into public.integration_providers(key,name,provider_type,supports_oauth,supports_webhook,supports_polling)
 values('enode','Enode','aggregator',true,true,true),('ocpp','Flexexa OCPP','ocpp',false,false,false);
alter table public.assets add constraint assets_tenant_id_customer_unique unique(tenant_id,id,customer_id);
create table public.provider_accounts (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 customer_id uuid not null,
 provider_id uuid not null references public.integration_providers(id) on delete restrict,
 environment text not null check(environment in ('sandbox','production')),
 external_account_id text check(private.flexexa_connect_external_id_valid(external_account_id)),
 credential_reference text check(credential_reference is null or (length(credential_reference)<=1024 and credential_reference ~ '^(arn:aws:secretsmanager:|vault://)' and credential_reference !~ '[[:cntrl:]]')),
 connection_status text not null default 'pending' check(connection_status in ('pending','connected','disconnected','error','revoked')),
 token_expires_at timestamptz(3), last_success_at timestamptz(3), last_error_at timestamptz(3),
 created_at timestamptz(3) not null default now(), updated_at timestamptz(3) not null default now(),
 unique(tenant_id,id), unique(tenant_id,id,customer_id,provider_id,environment),
 unique(tenant_id,provider_id,environment,external_account_id),
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id) on delete restrict,
 check(connection_status<>'connected' or external_account_id is not null)
);
comment on table public.provider_accounts is 'One customer per account in V1. Shared OCPP/fleet credentials require future explicit grants, never an unscoped nullable owner. Only vault references; browser column grants exclude them.';
create index provider_accounts_customer_idx on public.provider_accounts(tenant_id,customer_id,id);
create index provider_accounts_provider_idx on public.provider_accounts(provider_id);
create function private.flexexa_valid_connect_capabilities(p jsonb) returns boolean
language sql immutable set search_path='' as $$
 select case when jsonb_typeof(p)='array' then
  jsonb_array_length(p)<=15 and not exists(select 1 from jsonb_array_elements(p) v
   where jsonb_typeof(v)<>'string' or v#>>'{}' not in ('read_soc','start_charge','stop_charge','set_power_limit','set_current_limit','schedule_charge','read_power','read_energy','battery_charge','battery_discharge','export_to_grid','solar_read','v1g','v2g','v2h'))
  and (select count(*)=count(distinct v) from jsonb_array_elements(p) v)
 else false end
$$;
revoke all on function private.flexexa_valid_connect_capabilities(jsonb) from public,anon,authenticated;
create table public.asset_connections (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 customer_id uuid not null, asset_id uuid not null, provider_account_id uuid not null,
 provider_id uuid not null, environment text not null check(environment in ('sandbox','production')),
 external_asset_id text not null check(private.flexexa_connect_external_id_valid(external_asset_id)),
 connection_type text not null check(connection_type in ('aggregated_api','direct_api','ocpp','local_gateway','meter_protocol')),
 status text not null default 'pending' check(status in ('pending','connected','disconnected','error','revoked')),
 priority integer not null default 100 check(priority>=0),
 capabilities_json jsonb not null default '[]' check(private.flexexa_valid_connect_capabilities(capabilities_json)),
 capabilities_verified_at timestamptz(3),
 health text not null default 'unknown' check(health in ('healthy','degraded','unavailable','unknown')),
 last_sync_at timestamptz(3), last_seen_at timestamptz(3), state_observed_at timestamptz(3),
 valid_from timestamptz(3) not null default now(), valid_until timestamptz(3),
 created_at timestamptz(3) not null default now(), updated_at timestamptz(3) not null default now(),
 unique(tenant_id,id),
 foreign key(tenant_id,asset_id,customer_id) references public.assets(tenant_id,id,customer_id) on delete restrict,
 foreign key(tenant_id,provider_account_id,customer_id,provider_id,environment)
  references public.provider_accounts(tenant_id,id,customer_id,provider_id,environment) on delete restrict,
 check(private.flexexa_connect_time_valid(valid_from) and private.flexexa_connect_time_valid(valid_until) and (valid_until is null or valid_until>valid_from)),
 check(private.flexexa_connect_time_valid(capabilities_verified_at) and private.flexexa_connect_time_valid(last_seen_at) and private.flexexa_connect_time_valid(state_observed_at)),
 check(status<>'revoked' or valid_until is not null),
 exclude using gist(tenant_id with =,provider_account_id with =,external_asset_id with =,tstzrange(valid_from,valid_until,'[)') with &&)
);
comment on table public.asset_connections is 'Immutable time-bounded upstream binding, not control authority. Multiple providers share one canonical asset. Do not resolve tenant identity from external IDs in a webhook.';
create index asset_connections_route_idx on public.asset_connections(tenant_id,asset_id,environment,priority,id);
create index asset_connections_account_idx on public.asset_connections(tenant_id,provider_account_id,customer_id,provider_id,environment);
create index asset_connections_owner_idx on public.asset_connections(tenant_id,asset_id,customer_id);
create function private.flexexa_protect_connect_identity() returns trigger
language plpgsql set search_path='' as $$ begin
 if tg_op='DELETE' then raise exception using errcode='23514',message='CONNECT_HISTORY_IMMUTABLE'; end if;
 if tg_table_name='integration_providers' then
  if (new.id,new.key,new.provider_type) is distinct from (old.id,old.key,old.provider_type) then
   raise exception using errcode='23514',message='CONNECT_IDENTITY_IMMUTABLE'; end if;
 elsif tg_table_name='provider_accounts' then
  if (new.id,new.tenant_id,new.customer_id,new.provider_id,new.environment) is distinct from (old.id,old.tenant_id,old.customer_id,old.provider_id,old.environment)
   or (old.external_account_id is not null and new.external_account_id is distinct from old.external_account_id) then
   raise exception using errcode='23514',message='CONNECT_IDENTITY_IMMUTABLE'; end if;
  if old.connection_status='revoked' and new.connection_status<>'revoked' then
   raise exception using errcode='23514',message='INVALID_STATE_TRANSITION'; end if;
 else
  if (new.id,new.tenant_id,new.customer_id,new.asset_id,new.provider_id,new.provider_account_id,new.environment,new.external_asset_id,new.connection_type,new.valid_from)
   is distinct from (old.id,old.tenant_id,old.customer_id,old.asset_id,old.provider_id,old.provider_account_id,old.environment,old.external_asset_id,old.connection_type,old.valid_from) then
   raise exception using errcode='23514',message='CONNECT_IDENTITY_IMMUTABLE'; end if;
  if old.valid_until is not null and new.valid_until is distinct from old.valid_until then
   raise exception using errcode='23514',message='CONNECT_HISTORY_IMMUTABLE'; end if;
  if old.status='revoked' and new.status<>'revoked' then
   raise exception using errcode='23514',message='INVALID_STATE_TRANSITION'; end if;
 end if;
 new.updated_at:=now(); return new;
end $$;
revoke all on function private.flexexa_protect_connect_identity() from public,anon,authenticated;
create trigger protect_connect_identity before update or delete on public.integration_providers for each row execute function private.flexexa_protect_connect_identity();
create trigger protect_connect_identity before update or delete on public.provider_accounts for each row execute function private.flexexa_protect_connect_identity();
create trigger protect_connect_identity before update or delete on public.asset_connections for each row execute function private.flexexa_protect_connect_identity();
alter table public.integration_providers enable row level security;
alter table public.provider_accounts enable row level security;
alter table public.asset_connections enable row level security;
revoke all on public.integration_providers,public.provider_accounts,public.asset_connections from public,anon,authenticated;
grant select on public.integration_providers,public.asset_connections to authenticated;
grant select(id,tenant_id,customer_id,provider_id,environment,external_account_id,connection_status,token_expires_at,last_success_at,last_error_at,created_at,updated_at) on public.provider_accounts to authenticated;
create policy integration_providers_read on public.integration_providers for select to authenticated
 using(exists(select 1 from public.tenants t where private.flexexa_has_permission(t.id,'integrations.read')));
create policy provider_accounts_read on public.provider_accounts for select to authenticated
 using(private.flexexa_has_permission(tenant_id,'integrations.read'));
create policy asset_connections_read on public.asset_connections for select to authenticated
 using(private.flexexa_has_permission(tenant_id,'integrations.read') and private.flexexa_has_permission(tenant_id,'assets.read'));
-- No browser writes. Linking/discovery/revocation are separate transactional RPCs.
create function public.flexexa_get_connection_routes(p_tenant_id uuid,p_asset_id uuid,p_environment text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;
begin
 perform private.flexexa_assert_permission(p_tenant_id,'integrations.read');
 perform private.flexexa_assert_permission(p_tenant_id,'assets.read');
 if p_asset_id is null or p_environment is null or p_environment not in ('sandbox','production') then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 select coalesce(jsonb_agg(q.route order by q.priority,q.id),'[]'::jsonb) into result from (
  select c.id,c.priority,jsonb_build_object(
   'tenant_id',c.tenant_id,'asset_id',c.asset_id,'connection_id',c.id,'provider_id',c.provider_id,
   'provider_account_id',c.provider_account_id,'provider_key',p.key,'environment',c.environment,
   'external_asset_id',c.external_asset_id,'priority',c.priority,'connection_status',c.status,
   'account_status',a.connection_status,'provider_status',p.status,'health',c.health,
   'capabilities',c.capabilities_json,
   'capabilities_verified_at',to_char(c.capabilities_verified_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'last_seen_at',to_char(c.last_seen_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'state_observed_at',to_char(c.state_observed_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'valid_from',to_char(c.valid_from at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
   'valid_until',to_char(c.valid_until at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) as route
  from public.asset_connections c
  join public.provider_accounts a on (a.tenant_id,a.id,a.customer_id,a.provider_id,a.environment)=(c.tenant_id,c.provider_account_id,c.customer_id,c.provider_id,c.environment)
  join public.integration_providers p on p.id=c.provider_id
  join public.assets asset on (asset.tenant_id,asset.id,asset.customer_id)=(c.tenant_id,c.asset_id,c.customer_id)
  join public.customers customer on (customer.tenant_id,customer.id)=(asset.tenant_id,asset.customer_id)
  join public.sites site on (site.tenant_id,site.id,site.customer_id)=(asset.tenant_id,asset.site_id,asset.customer_id)
  where c.tenant_id=p_tenant_id and c.asset_id=p_asset_id and c.environment=p_environment
   and asset.status not in ('disabled','archived') and customer.status='active' and site.status='active'
  order by c.priority,c.id limit 1001
 ) q;
 if jsonb_array_length(result)>1000 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return result;
end $$;
revoke all on function public.flexexa_get_connection_routes(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.flexexa_get_connection_routes(uuid,uuid,text) to authenticated;
