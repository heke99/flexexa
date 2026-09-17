create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug = lower(slug)),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  slug text not null unique check (slug = lower(slug)),
  status text not null default 'active' check (status in ('active','suspended','closed')),
  country_code text not null default 'SE' check (country_code ~ '^[A-Z]{2}$'),
  timezone text not null default 'Europe/Stockholm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);

create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null unique check (permission_key = lower(permission_key)),
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null unique check (role_key = lower(role_key)),
  display_name text not null,
  scope text not null check (scope in ('platform','tenant')),
  system_managed boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('invited','active','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (tenant_id, id)
);

create table public.membership_roles (
  tenant_id uuid not null,
  membership_id uuid not null,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (tenant_id, membership_id, role_id),
  foreign key (tenant_id, membership_id)
    references public.memberships(tenant_id, id) on delete cascade
);

create table public.membership_permission_overrides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  membership_id uuid not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  effect text not null check (effect in ('allow','deny')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, membership_id, permission_id),
  foreign key (tenant_id, membership_id)
    references public.memberships(tenant_id, id) on delete cascade
);

create table public.platform_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_membership_roles (
  platform_membership_id uuid not null references public.platform_memberships(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (platform_membership_id, role_id)
);

create table public.service_identities (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique check (service_key = lower(service_key)),
  display_name text not null,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now()
);

create table public.service_identity_tenant_grants (
  service_identity_id uuid not null references public.service_identities(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_identity_id, tenant_id, permission_id)
);

create table public.api_clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  client_key text not null,
  display_name text not null,
  status text not null default 'active' check (status in ('active','suspended','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, client_key),
  unique (tenant_id, id)
);

create table public.api_client_permissions (
  tenant_id uuid not null,
  api_client_id uuid not null,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tenant_id, api_client_id, permission_id),
  foreign key (tenant_id, api_client_id)
    references public.api_clients(tenant_id, id) on delete cascade
);

create index memberships_user_id_idx on public.memberships(user_id);
create index memberships_tenant_status_idx on public.memberships(tenant_id, status);
create index membership_roles_membership_idx on public.membership_roles(tenant_id, membership_id);
create index overrides_membership_idx on public.membership_permission_overrides(tenant_id, membership_id);
create index service_identity_grants_tenant_idx on public.service_identity_tenant_grants(tenant_id);
create index api_clients_tenant_status_idx on public.api_clients(tenant_id, status);

alter table public.organizations enable row level security;
alter table public.tenants enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_roles enable row level security;
alter table public.membership_permission_overrides enable row level security;
alter table public.platform_memberships enable row level security;
alter table public.platform_membership_roles enable row level security;
alter table public.service_identities enable row level security;
alter table public.service_identity_tenant_grants enable row level security;
alter table public.api_clients enable row level security;
alter table public.api_client_permissions enable row level security;

revoke all on public.organizations from anon, authenticated;
revoke all on public.tenants from anon, authenticated;
revoke all on public.permissions from anon, authenticated;
revoke all on public.roles from anon, authenticated;
revoke all on public.role_permissions from anon, authenticated;
revoke all on public.memberships from anon, authenticated;
revoke all on public.membership_roles from anon, authenticated;
revoke all on public.membership_permission_overrides from anon, authenticated;
revoke all on public.platform_memberships from anon, authenticated;
revoke all on public.platform_membership_roles from anon, authenticated;
revoke all on public.service_identities from anon, authenticated;
revoke all on public.service_identity_tenant_grants from anon, authenticated;
revoke all on public.api_clients from anon, authenticated;
revoke all on public.api_client_permissions from anon, authenticated;

insert into public.permissions (permission_key, description) values
  ('tenant.read','Read tenant data'),
  ('tenant.manage','Manage tenant settings'),
  ('membership.read','Read tenant memberships'),
  ('membership.manage','Manage tenant memberships'),
  ('role.read','Read role assignments'),
  ('role.manage','Manage role assignments'),
  ('asset.read','Read assets'),
  ('asset.manage','Manage assets'),
  ('control.read','Read control state'),
  ('control.execute','Execute control actions'),
  ('market.read','Read market/flex state'),
  ('market.manage','Manage market/flex operations'),
  ('settlement.read','Read settlement data'),
  ('settlement.manage','Manage settlement data'),
  ('settlement.approve','Approve settlements'),
  ('finance.read','Read financial data'),
  ('finance.manage','Manage financial data'),
  ('developer.api','Use developer APIs'),
  ('security.manage','Manage security settings'),
  ('platform.manage','Manage platform-level settings')
on conflict (permission_key) do nothing;

insert into public.roles (role_key, display_name, scope, system_managed) values
  ('superadmin','Superadmin','platform',true),
  ('platform_admin','Platform Admin','platform',true),
  ('tenant_admin','Tenant Admin','tenant',true),
  ('operator','Operator','tenant',true),
  ('market_operator','Market Operator','tenant',true),
  ('finance','Finance','tenant',true),
  ('settlement_approver','Settlement Approver','tenant',true),
  ('support','Support','tenant',true),
  ('developer','Developer','tenant',true),
  ('security_admin','Security Admin','tenant',true),
  ('viewer','Viewer','tenant',true)
on conflict (role_key) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
join public.permissions p on
  (r.role_key = 'tenant_admin' and p.permission_key in ('tenant.read','tenant.manage','membership.read','membership.manage','role.read','role.manage','asset.read','asset.manage','control.read','market.read','settlement.read','finance.read','developer.api'))
  or (r.role_key = 'operator' and p.permission_key in ('tenant.read','asset.read','asset.manage','control.read','control.execute','market.read'))
  or (r.role_key = 'market_operator' and p.permission_key in ('tenant.read','asset.read','control.read','market.read','market.manage','settlement.read'))
  or (r.role_key = 'finance' and p.permission_key in ('tenant.read','settlement.read','finance.read','finance.manage'))
  or (r.role_key = 'settlement_approver' and p.permission_key in ('tenant.read','settlement.read','settlement.approve','finance.read'))
  or (r.role_key = 'support' and p.permission_key in ('tenant.read','membership.read','asset.read','control.read','market.read'))
  or (r.role_key = 'developer' and p.permission_key in ('tenant.read','asset.read','market.read','developer.api'))
  or (r.role_key = 'security_admin' and p.permission_key in ('tenant.read','membership.read','role.read','security.manage'))
  or (r.role_key = 'viewer' and p.permission_key in ('tenant.read','asset.read','control.read','market.read','settlement.read','finance.read'))
  or (r.role_key in ('superadmin','platform_admin') and p.permission_key in ('platform.manage','tenant.read','tenant.manage','membership.read','membership.manage','role.read','role.manage','asset.read','asset.manage','control.read','control.execute','market.read','market.manage','settlement.read','settlement.manage','settlement.approve','finance.read','finance.manage','developer.api','security.manage'))
on conflict do nothing;
