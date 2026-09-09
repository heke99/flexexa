-- V1 core alignment. Forward-only: preserve applied history and existing identities.
-- No public/tenant write grants are introduced by this migration.
create table public.market_areas (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  code text not null unique,
  name text not null,
  timezone text not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  valid_from timestamptz not null default '-infinity',
  valid_until timestamptz,
  check (valid_until is null or valid_until > valid_from)
);
alter table public.market_areas enable row level security;
revoke all on public.market_areas from public, anon, authenticated;
grant select on public.market_areas to authenticated;
create policy market_areas_catalog_read on public.market_areas for select to authenticated using (true);
-- Swedish seed data is a country-pack concern; no Swedish enums in generic tables.
insert into public.market_areas(country_code,code,name,timezone,currency)
select 'SE',code,code,'Europe/Stockholm','SEK' from unnest(array['SE1','SE2','SE3','SE4']) code;

alter table public.organizations
  add column organization_number text,
  add column vat_number text,
  add column organization_type text not null default 'partner'
    check (organization_type in ('platform','retailer','charger_oem','vehicle_oem','aggregator','bsp','brp','dso','tso','energy_service_provider','fleet','partner')),
  add column country_code text not null default 'SE' check (country_code ~ '^[A-Z]{2}$'),
  add column timezone text not null default 'Europe/Stockholm',
  add column currency text not null default 'SEK' check (currency ~ '^[A-Z]{3}$');
alter table public.tenants add column default_market_area_id uuid references public.market_areas(id);

alter table public.customers
  add column first_name text,
  add column last_name text,
  add column company_name text,
  add column organization_number text,
  add column email text,
  add column phone text,
  add column locale text not null default 'sv-SE',
  add column timezone text not null default 'Europe/Stockholm';
alter table public.sites
  add column address_line_1 text,
  add column address_line_2 text,
  add column postal_code text,
  add column city text,
  add column latitude numeric(9,6) check (latitude between -90 and 90),
  add column longitude numeric(9,6) check (longitude between -180 and 180),
  add column market_area_id uuid references public.market_areas(id),
  add column main_fuse_amps numeric(12,3) check (main_fuse_amps > 0),
  add column phase_count smallint check (phase_count in (1,2,3)),
  add column max_import_kw numeric(18,6) check (max_import_kw >= 0),
  add column max_export_kw numeric(18,6) check (max_export_kw >= 0);

alter table public.metering_points rename column metering_point_identifier to external_metering_point_id;
alter table public.metering_points rename column direction to metering_point_type;
alter table public.metering_points rename column interval_minutes to measurement_resolution_minutes;
alter table public.metering_points
  add column grid_area_code text,
  add column market_area_id uuid references public.market_areas(id),
  add column import_enabled boolean not null default true,
  add column export_enabled boolean not null default false,
  add column valid_from timestamptz not null default now(),
  add column valid_until timestamptz,
  add constraint metering_point_valid_period check (valid_until is null or valid_until > valid_from);
update public.metering_points m set market_area_id=a.id from public.market_areas a where a.code=m.price_area;
update public.metering_points set import_enabled=(metering_point_type <> 'production'), export_enabled=(metering_point_type <> 'consumption');
-- Fail migration instead of silently losing a legacy area identifier.
do $$ begin
  if exists(select 1 from public.metering_points where price_area is not null and market_area_id is null) then
    raise exception 'UNMAPPED_MARKET_AREA';
  end if;
end $$;
alter table public.metering_points drop column price_area;
alter table public.metering_points drop constraint metering_points_interval_minutes_check;
alter table public.metering_points add constraint metering_resolution_positive check (measurement_resolution_minutes > 0);

alter table public.assets rename column external_asset_id to external_id;
alter table public.assets drop constraint assets_asset_type_check;
update public.assets set asset_type=case asset_type
  when 'vehicle' then 'ev' when 'ev_charger' then 'evse'
  when 'stationary_battery' then 'battery' when 'solar' then 'solar_inverter'
  when 'other' then 'other_der' else asset_type end;
alter table public.assets
  add constraint assets_canonical_type check (asset_type in ('ev','evse','battery','solar_inverter','meter','heat_pump','hems','hvac','industrial_load','generator','other_der','other_flexible_load')),
  add column serial_number text,
  add column commissioned_at timestamptz,
  add column decommissioned_at timestamptz,
  add constraint assets_service_period check (decommissioned_at is null or commissioned_at is null or decommissioned_at >= commissioned_at);
alter table public.asset_capabilities rename column capability_key to capability;
alter table public.asset_capabilities rename column extensions to metadata_json;
alter table public.asset_capabilities
  add column min_value numeric,
  add column max_value numeric,
  add column unit text,
  add column source text not null default 'unverified',
  add column verified_at timestamptz,
  add column ramp_rate_kw_s numeric check (ramp_rate_kw_s >= 0),
  add constraint capability_generic_range check (min_value is null or max_value is null or min_value <= max_value);
update public.asset_capabilities set ramp_rate_kw_s=ramp_rate_kw_per_min/60 where ramp_rate_kw_per_min is not null;
alter table public.asset_capabilities drop column ramp_rate_kw_per_min;

create index sites_market_area_idx on public.sites(market_area_id);
create index metering_points_market_area_idx on public.metering_points(market_area_id);

-- Ownership never changes through a row UPDATE, even by a future RPC.
-- An explicit transfer requires a separately reviewed migration/workflow.
create function private.flexexa_immutable_tenant_id()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.tenant_id is distinct from old.tenant_id then
    raise exception using errcode='23514',message='TENANT_ID_IMMUTABLE';
  end if;
  return new;
end $$;
revoke all on function private.flexexa_immutable_tenant_id() from public,anon,authenticated;
do $$ declare t text; begin
  foreach t in array array['customers','sites','metering_points','assets','asset_capabilities','memberships','membership_roles','membership_permission_overrides','api_clients','api_client_permissions','service_identity_tenant_grants'] loop
    execute format('create trigger tenant_id_immutable before update on public.%I for each row execute function private.flexexa_immutable_tenant_id()',t);
  end loop;
end $$;
comment on table public.market_areas is 'Canonical country-neutral catalog; seeded national data is versioned.';
