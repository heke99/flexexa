
insert into public.permissions (permission_key, description) values
  ('customer.read','Read customers'),
  ('customer.manage','Manage customers'),
  ('site.read','Read sites'),
  ('site.manage','Manage sites'),
  ('metering_point.read','Read metering points'),
  ('metering_point.manage','Manage metering points')
on conflict (permission_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (r.role_key = 'tenant_admin' and p.permission_key in (
    'customer.read','customer.manage','site.read','site.manage',
    'metering_point.read','metering_point.manage'
  ))
  or (r.role_key in ('operator','market_operator','support','developer','viewer')
      and p.permission_key in ('customer.read','site.read','metering_point.read'))
on conflict do nothing;

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  external_customer_id text,
  customer_type text not null check (customer_type in ('person','company')),
  display_name text not null check (length(trim(display_name)) > 0),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, external_customer_id)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  customer_id uuid not null,
  external_site_id text,
  name text not null check (length(trim(name)) > 0),
  country_code text not null default 'SE' check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'Europe/Stockholm',
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, id, customer_id),
  unique (tenant_id, external_site_id),
  foreign key (tenant_id, customer_id)
    references public.customers (tenant_id, id)
    on delete restrict
);

create table public.metering_points (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  site_id uuid not null,
  metering_point_identifier text not null check (length(trim(metering_point_identifier)) > 0),
  direction text not null default 'consumption'
    check (direction in ('consumption','production','bidirectional')),
  price_area text check (price_area is null or price_area in ('SE1','SE2','SE3','SE4')),
  interval_minutes integer not null default 15 check (interval_minutes in (15,60)),
  status text not null default 'active' check (status in ('active','inactive','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, metering_point_identifier),
  foreign key (tenant_id, site_id)
    references public.sites (tenant_id, id)
    on delete restrict
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  site_id uuid not null,
  customer_id uuid not null,
  external_asset_id text,
  asset_type text not null check (
    asset_type in (
      'vehicle','ev_charger','stationary_battery',
      'solar','hvac','meter','other'
    )
  ),
  display_name text not null check (length(trim(display_name)) > 0),
  manufacturer text,
  model text,
  status text not null default 'active'
    check (status in ('active','offline','disabled','archived')),
  controllable boolean not null default false,
  rated_power_kw numeric(12,3)
    check (rated_power_kw is null or rated_power_kw >= 0),
  energy_capacity_kwh numeric(14,3)
    check (energy_capacity_kwh is null or energy_capacity_kwh >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, external_asset_id),
  foreign key (tenant_id, customer_id)
    references public.customers (tenant_id, id)
    on delete restrict,
  foreign key (tenant_id, site_id, customer_id)
    references public.sites (tenant_id, id, customer_id)
    on delete restrict
);

create table public.asset_capabilities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  asset_id uuid not null,
  capability_key text not null
    check (capability_key ~ '^[a-z][a-z0-9_]*$'),
  direction text not null default 'not_applicable'
    check (direction in ('consume','produce','bidirectional','not_applicable')),
  min_power_kw numeric(12,3)
    check (min_power_kw is null or min_power_kw >= 0),
  max_power_kw numeric(12,3)
    check (max_power_kw is null or max_power_kw >= 0),
  energy_capacity_kwh numeric(14,3)
    check (energy_capacity_kwh is null or energy_capacity_kwh >= 0),
  ramp_rate_kw_per_min numeric(12,3)
    check (ramp_rate_kw_per_min is null or ramp_rate_kw_per_min >= 0),
  granularity_seconds integer
    check (granularity_seconds is null or granularity_seconds > 0),
  status text not null default 'active'
    check (status in ('active','inactive','unknown')),
  extensions jsonb not null default '{}'::jsonb
    check (jsonb_typeof(extensions) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, id),
  unique (tenant_id, asset_id, capability_key),
  check (
    min_power_kw is null
    or max_power_kw is null
    or min_power_kw <= max_power_kw
  ),
  foreign key (tenant_id, asset_id)
    references public.assets (tenant_id, id)
    on delete cascade
);

create index customers_tenant_status_idx
  on public.customers (tenant_id, status);

create index sites_tenant_customer_idx
  on public.sites (tenant_id, customer_id);

create index metering_points_tenant_site_idx
  on public.metering_points (tenant_id, site_id);

create index assets_tenant_site_idx
  on public.assets (tenant_id, site_id);

create index assets_tenant_customer_idx
  on public.assets (tenant_id, customer_id);

create index assets_tenant_type_status_idx
  on public.assets (tenant_id, asset_type, status);

create index asset_capabilities_tenant_asset_idx
  on public.asset_capabilities (tenant_id, asset_id);

create or replace function private.flexexa_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

revoke all on function private.flexexa_touch_updated_at() from public;

create trigger organizations_touch_updated_at
before update on public.organizations
for each row execute function private.flexexa_touch_updated_at();

create trigger tenants_touch_updated_at
before update on public.tenants
for each row execute function private.flexexa_touch_updated_at();

create trigger memberships_touch_updated_at
before update on public.memberships
for each row execute function private.flexexa_touch_updated_at();

create trigger platform_memberships_touch_updated_at
before update on public.platform_memberships
for each row execute function private.flexexa_touch_updated_at();

create trigger api_clients_touch_updated_at
before update on public.api_clients
for each row execute function private.flexexa_touch_updated_at();

create trigger customers_touch_updated_at
before update on public.customers
for each row execute function private.flexexa_touch_updated_at();

create trigger sites_touch_updated_at
before update on public.sites
for each row execute function private.flexexa_touch_updated_at();

create trigger metering_points_touch_updated_at
before update on public.metering_points
for each row execute function private.flexexa_touch_updated_at();

create trigger assets_touch_updated_at
before update on public.assets
for each row execute function private.flexexa_touch_updated_at();

create trigger asset_capabilities_touch_updated_at
before update on public.asset_capabilities
for each row execute function private.flexexa_touch_updated_at();

alter table public.customers enable row level security;
alter table public.sites enable row level security;
alter table public.metering_points enable row level security;
alter table public.assets enable row level security;
alter table public.asset_capabilities enable row level security;

revoke all on public.customers from anon, authenticated;
revoke all on public.sites from anon, authenticated;
revoke all on public.metering_points from anon, authenticated;
revoke all on public.assets from anon, authenticated;
revoke all on public.asset_capabilities from anon, authenticated;

grant select on public.customers to authenticated;
grant select on public.sites to authenticated;
grant select on public.metering_points to authenticated;
grant select on public.assets to authenticated;
grant select on public.asset_capabilities to authenticated;

create policy customers_authorized_read
on public.customers
for select to authenticated
using (
  private.flexexa_has_permission(tenant_id, 'customer.read')
  or private.flexexa_is_platform_admin()
);

create policy sites_authorized_read
on public.sites
for select to authenticated
using (
  private.flexexa_has_permission(tenant_id, 'site.read')
  or private.flexexa_is_platform_admin()
);

create policy metering_points_authorized_read
on public.metering_points
for select to authenticated
using (
  private.flexexa_has_permission(tenant_id, 'metering_point.read')
  or private.flexexa_is_platform_admin()
);

create policy assets_authorized_read
on public.assets
for select to authenticated
using (
  private.flexexa_has_permission(tenant_id, 'asset.read')
  or private.flexexa_is_platform_admin()
);

create policy asset_capabilities_authorized_read
on public.asset_capabilities
for select to authenticated
using (
  private.flexexa_has_permission(tenant_id, 'asset.read')
  or private.flexexa_is_platform_admin()
);
