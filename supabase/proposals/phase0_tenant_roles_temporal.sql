-- Tenant-owned role instances, canonical permissions and temporal authorization.
-- This bootstrap conversion is intentionally restricted to an empty tenant estate.
do $$ begin
 if exists(select 1 from public.tenants) then raise exception 'RBAC_BOOTSTRAP_REQUIRES_EMPTY_TENANTS'; end if;
end $$;
alter table public.permissions
 add column domain text,
 add column action text,
 add column scope_type text not null default 'tenant' check(scope_type in ('tenant','platform')),
 add column risk_level text not null default 'normal' check(risk_level in ('normal','high','critical')),
 add column requires_mfa boolean not null default false,
 add column requires_step_up boolean not null default false,
 add column status text not null default 'active' check(status in ('active','deprecated','retired')),
 add column updated_at timestamptz not null default now();
insert into public.permissions(permission_key,description)
select k,k from unnest(string_to_array('tenants.read tenants.manage users.read users.invite users.manage roles.read roles.manage customers.read customers.write customers.export sites.read sites.write assets.read assets.write assets.control assets.emergency_control integrations.read integrations.manage prices.read tariffs.read tariffs.manage optimizer.read optimizer.run flex.read flex.manage flex.reserve flex.submit_bid flex.accept_commitment flex.dispatch flex.override_dispatch prequalification.read prequalification.manage settlement.read settlement.import settlement.reconcile settlement.approve ledger.read ledger.post ledger.adjust rewards.read rewards.manage rules.read rules.draft rules.bind rules.approve rules.publish api_clients.read api_clients.manage webhooks.read webhooks.manage audit.read audit.export incidents.read incidents.manage security.manage metering_points.read metering_points.write platform.manage',' ')) k
on conflict(permission_key) do nothing;
update public.permissions set domain=split_part(permission_key,'.',1),action=split_part(permission_key,'.',2);
alter table public.permissions alter column domain set not null, alter column action set not null;
update public.permissions set scope_type='platform' where permission_key='platform.manage';
update public.permissions set requires_mfa=true,risk_level='high' where permission_key in ('assets.emergency_control','flex.submit_bid','flex.accept_commitment','flex.dispatch','flex.override_dispatch','settlement.approve','ledger.post','ledger.adjust','rules.approve','rules.publish','security.manage');
-- A verified step-up ticket evaluator is a later gate; requires_step_up fails closed.
create table public.permission_aliases (
 alias_key text primary key,
 canonical_permission_id uuid not null references public.permissions(id)
);
insert into public.permission_aliases(alias_key,canonical_permission_id)
select x.alias_key,p.id from (values
 ('tenant.read','tenants.read'),('tenant.manage','tenants.manage'),
 ('membership.read','users.read'),('membership.manage','users.manage'),
 ('role.read','roles.read'),('role.manage','roles.manage'),
 ('customer.read','customers.read'),('customer.manage','customers.write'),
 ('site.read','sites.read'),('site.manage','sites.write'),
 ('asset.read','assets.read'),('asset.manage','assets.write'),
 ('metering_point.read','metering_points.read'),('metering_point.manage','metering_points.write'),
 ('control.read','assets.read'),('control.execute','assets.control'),
 ('market.read','flex.read'),('market.manage','flex.manage'),
 ('settlement.manage','settlement.reconcile'),('finance.read','ledger.read'),
 ('finance.manage','settlement.reconcile'),('developer.api','api_clients.manage')
) x(alias_key,canonical_key) join public.permissions p on p.permission_key=x.canonical_key;
update public.permissions set status='deprecated' where permission_key in (select alias_key from public.permission_aliases);
create function private.flexexa_canonical_permission(p_key text)
returns text language sql stable set search_path='' as $$
 select coalesce((select p.permission_key from public.permission_aliases a join public.permissions p on p.id=a.canonical_permission_id where a.alias_key=lower(p_key)),lower(p_key))
$$;

create table public.role_templates (
 id uuid primary key default gen_random_uuid(), role_key text not null unique,
 name text not null, description text not null default '',status text not null default 'active' check(status in ('active','retired'))
);
create table public.role_template_permissions (
 role_template_id uuid not null references public.role_templates(id),
 permission_id uuid not null references public.permissions(id),
 primary key(role_template_id,permission_id)
);
insert into public.role_templates(role_key,name) select role_key,display_name from public.roles where scope='tenant';
-- No tenants exist: migrate global tenant-role definitions to a template catalog.
-- Every new tenant gets independent role IDs; no membership is created implicitly.
delete from public.roles where scope='tenant';
alter table public.roles drop constraint roles_role_key_key;
alter table public.roles rename column display_name to name;
alter table public.roles rename column scope to scope_type;
alter table public.roles rename column system_managed to is_system_role;
alter table public.roles
 add column tenant_id uuid references public.tenants(id),
 add column role_template_id uuid references public.role_templates(id),
 add column description text not null default '',
 add column status text not null default 'active' check(status in ('active','suspended','retired')),
 add column updated_at timestamptz not null default now(),
 add constraint role_owner_scope check((scope_type='tenant' and tenant_id is not null) or (scope_type='platform' and tenant_id is null)),
 add unique(tenant_id,id), add unique(tenant_id,role_key);
create unique index platform_role_key_unique on public.roles(role_key) where tenant_id is null;
alter table public.role_permissions
 add column id uuid not null default gen_random_uuid() unique,
 add column tenant_id uuid,
 add column effect text not null default 'allow' check(effect in ('allow','deny')),
 add column condition_json jsonb not null default '{}' check(jsonb_typeof(condition_json)='object'),
 add column valid_from timestamptz not null default '-infinity',
 add column valid_until timestamptz,
 add constraint role_permission_period check(valid_until is null or valid_until>valid_from),
 add foreign key(tenant_id,role_id) references public.roles(tenant_id,id);
-- Platform roles must not carry implicit tenant grants.
delete from public.role_permissions rp using public.roles r, public.permissions p
 where rp.role_id=r.id and rp.permission_id=p.id and r.scope_type='platform' and p.scope_type<>'platform';
alter table public.membership_roles
 add column id uuid not null default gen_random_uuid() unique,
 add column valid_from timestamptz not null default '-infinity',
 add column valid_until timestamptz,
 add column created_by uuid references auth.users(id) on delete set null,
 add constraint membership_role_period check(valid_until is null or valid_until>valid_from),
 add foreign key(tenant_id,role_id) references public.roles(tenant_id,id);
alter table public.memberships
 add column valid_from timestamptz not null default '-infinity',
 add column valid_until timestamptz,
 add column invited_by uuid references auth.users(id) on delete set null,
 add constraint membership_period check(valid_until is null or valid_until>valid_from);
alter table public.membership_permission_overrides
 add column condition_json jsonb not null default '{}' check(jsonb_typeof(condition_json)='object'),
 add column valid_from timestamptz not null default '-infinity',
 add column valid_until timestamptz,
 add column created_by uuid references auth.users(id) on delete set null,
 add column approved_by uuid references auth.users(id) on delete set null,
 add constraint override_period check(valid_until is null or valid_until>valid_from);

-- Default role matrix: explicit entries, no wildcard grants.
insert into public.role_template_permissions(role_template_id,permission_id)
select r.id,p.id from (values
 ('tenant_admin','api_clients.manage api_clients.read assets.read assets.write audit.read customers.export customers.read customers.write flex.read incidents.manage incidents.read integrations.manage integrations.read ledger.read metering_points.read metering_points.write optimizer.read optimizer.run prices.read rewards.read roles.manage roles.read settlement.read sites.read sites.write tariffs.manage tariffs.read tenants.manage tenants.read users.invite users.manage users.read webhooks.manage webhooks.read'),
 ('operator','assets.control assets.read assets.write customers.read flex.read incidents.manage incidents.read integrations.read metering_points.read optimizer.read optimizer.run prices.read sites.read tariffs.read tenants.read'),
 ('market_operator','assets.read customers.read flex.accept_commitment flex.dispatch flex.manage flex.read flex.reserve flex.submit_bid incidents.manage incidents.read metering_points.read optimizer.read prequalification.manage prequalification.read prices.read settlement.read sites.read tariffs.read tenants.read'),
 ('finance','ledger.read rewards.read settlement.import settlement.read settlement.reconcile tenants.read'),
 ('settlement_approver','audit.read ledger.read settlement.approve settlement.read tenants.read'),
 ('support','assets.read customers.read flex.read incidents.read integrations.read metering_points.read optimizer.read prices.read sites.read tariffs.read tenants.read users.read'),
 ('developer','api_clients.manage api_clients.read assets.read customers.read flex.read integrations.read metering_points.read optimizer.read prices.read sites.read tariffs.read tenants.read webhooks.manage webhooks.read'),
 ('security_admin','audit.export audit.read incidents.manage incidents.read roles.read security.manage tenants.read users.read'),
 ('viewer','assets.read customers.read flex.read ledger.read metering_points.read optimizer.read prices.read rewards.read settlement.read sites.read tariffs.read tenants.read')
) x(role_key,permission_keys)
cross join lateral unnest(string_to_array(x.permission_keys,' ')) k
join public.role_templates r on r.role_key=x.role_key
join public.permissions p on p.permission_key=k;

-- Preserve historical assignments instead of overwriting a unique pair forever.
-- PostgreSQL exclusions atomically reject overlapping grants for the same pair.
create extension if not exists btree_gist with schema extensions;
alter table public.role_permissions drop constraint role_permissions_pkey;
alter table public.role_permissions add constraint role_permissions_pkey primary key using index role_permissions_id_key;
alter table public.role_permissions add constraint role_permission_no_overlap exclude using gist
 (role_id with =,permission_id with =,tstzrange(valid_from,valid_until,'[)') with &&);
alter table public.membership_roles drop constraint membership_roles_pkey;
alter table public.membership_roles add constraint membership_roles_pkey primary key using index membership_roles_id_key;
alter table public.membership_roles add constraint membership_role_no_overlap exclude using gist
 (membership_id with =,role_id with =,tstzrange(valid_from,valid_until,'[)') with &&);
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.membership_permission_overrides'::regclass and contype='u' loop
  execute format('alter table public.membership_permission_overrides drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.membership_permission_overrides add constraint permission_override_no_overlap exclude using gist
 (membership_id with =,permission_id with =,tstzrange(valid_from,valid_until,'[)') with &&);

create function private.flexexa_seed_tenant_roles()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.roles(tenant_id,role_key,name,scope_type,is_system_role,role_template_id)
 select new.id,role_key,name,'tenant',true,id from public.role_templates where status='active';
 insert into public.role_permissions(tenant_id,role_id,permission_id)
 select new.id,r.id,tp.permission_id from public.roles r join public.role_template_permissions tp on tp.role_template_id=r.role_template_id where r.tenant_id=new.id;
 return new;
end $$;
create trigger tenant_role_templates after insert on public.tenants for each row execute function private.flexexa_seed_tenant_roles();
create or replace function private.flexexa_enforce_role_scope()
returns trigger language plpgsql security definer set search_path='' as $$
declare r public.roles%rowtype;
begin
 select * into r from public.roles where id=new.role_id;
 if not found then raise exception using errcode='23503',message='ROLE_NOT_FOUND'; end if;
 if (tg_table_name='membership_roles' and r.scope_type<>'tenant') or
    (tg_table_name='platform_membership_roles' and r.scope_type<>'platform') then
   raise exception using errcode='23514',message='ROLE_SCOPE_MISMATCH';
 end if;
 if tg_table_name='role_permissions' then
   if new.tenant_id is distinct from r.tenant_id then
     raise exception using errcode='23514',message='ROLE_OWNER_MISMATCH';
   end if;
   if (select scope_type from public.permissions where id=new.permission_id) is distinct from r.scope_type then
     raise exception using errcode='23514',message='PERMISSION_SCOPE_MISMATCH';
   end if;
 end if;
 return new;
end $$;
create trigger role_permission_owner before insert or update on public.role_permissions for each row execute function private.flexexa_enforce_role_scope();
create trigger tenant_id_immutable before update on public.roles for each row execute function private.flexexa_immutable_tenant_id();

create or replace function private.flexexa_current_membership_id(p_tenant_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
 select m.id from public.memberships m
 join public.tenants t on t.id=m.tenant_id and t.status='active'
 join public.organizations o on o.id=t.organization_id and o.status='active'
 where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active'
 and m.valid_from<=now() and (m.valid_until is null or m.valid_until>now())
 and coalesce(auth.jwt()->>'is_anonymous','false')='false'
$$;
create or replace function private.flexexa_is_tenant_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.flexexa_current_membership_id(p_tenant_id) is not null
$$;
create or replace function private.flexexa_has_role(p_tenant_id uuid,p_role_key text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id and r.tenant_id=mr.tenant_id
 where mr.tenant_id=p_tenant_id and mr.membership_id=private.flexexa_current_membership_id(p_tenant_id)
 and r.scope_type='tenant' and r.status='active' and r.role_key=lower(p_role_key)
 and mr.valid_from<=now() and (mr.valid_until is null or mr.valid_until>now()))
$$;
create or replace function private.flexexa_is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and coalesce(auth.jwt()->>'is_anonymous','false')='false'
 and exists(select 1 from public.platform_memberships pm join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
 join public.roles r on r.id=pmr.role_id where pm.user_id=auth.uid() and pm.status='active'
 and r.scope_type='platform' and r.status='active' and r.role_key in ('platform_admin','superadmin'))
$$;
create or replace function private.flexexa_is_superadmin()
returns boolean language sql stable security definer set search_path='' as $$
 select private.flexexa_is_platform_admin() and exists(select 1 from public.platform_memberships pm join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
 join public.roles r on r.id=pmr.role_id where pm.user_id=auth.uid() and pm.status='active'
 and r.scope_type='platform' and r.status='active' and r.role_key='superadmin')
$$;
create or replace function private.flexexa_has_permission(p_tenant_id uuid,p_permission_key text)
returns boolean language sql stable security definer set search_path='' as $$
 with member as(select private.flexexa_current_membership_id(p_tenant_id) id),
 target as(select p.* from public.permissions p where p.permission_key=private.flexexa_canonical_permission(p_permission_key) and p.status='active' and p.scope_type='tenant'),
 grants as(
  select rp.effect,rp.condition_json from member m
  join public.membership_roles mr on mr.tenant_id=p_tenant_id and mr.membership_id=m.id
  join public.roles r on r.id=mr.role_id and r.tenant_id=p_tenant_id and r.status='active' and r.scope_type='tenant'
  join public.role_permissions rp on rp.role_id=r.id and rp.tenant_id=p_tenant_id
  join public.permissions p on p.id=rp.permission_id and p.status<>'retired'
  join target t on t.permission_key=private.flexexa_canonical_permission(p.permission_key)
  where mr.valid_from<=now() and (mr.valid_until is null or mr.valid_until>now()) and rp.valid_from<=now() and (rp.valid_until is null or rp.valid_until>now())
  union all
  select x.effect,x.condition_json from member m
  join public.membership_permission_overrides x on x.tenant_id=p_tenant_id and x.membership_id=m.id
  join public.permissions p on p.id=x.permission_id and p.status<>'retired'
  join target t on t.permission_key=private.flexexa_canonical_permission(p.permission_key)
  where x.valid_from<=now() and (x.valid_until is null or x.valid_until>now())
 )
 select exists(select 1 from member m cross join target t where m.id is not null
  and (not t.requires_mfa or coalesce(auth.jwt()->>'aal','')='aal2')
  and not t.requires_step_up
  and not exists(select 1 from grants where effect='deny')
  and exists(select 1 from grants where effect='allow' and condition_json='{}'::jsonb))
$$;
create or replace function private.flexexa_effective_permissions(p_tenant_id uuid)
returns setof text language sql stable security definer set search_path='' as $$
 select p.permission_key from public.permissions p where p.status='active' and private.flexexa_has_permission(p_tenant_id,p.permission_key) order by p.permission_key
$$;
-- Tenant role instances and their grants are no longer global catalog data.
drop policy roles_authenticated_read on public.roles;
create policy roles_scoped_read on public.roles for select to authenticated using
 (private.flexexa_has_permission(tenant_id,'roles.read') or private.flexexa_is_platform_admin());
drop policy role_permissions_authenticated_read on public.role_permissions;
create policy role_permissions_scoped_read on public.role_permissions for select to authenticated using
 (private.flexexa_has_permission(tenant_id,'roles.read') or private.flexexa_is_platform_admin());

alter table public.service_identities rename column display_name to name;
alter table public.service_identities add column service_type text not null default 'internal', add column updated_at timestamptz not null default now();
alter table public.service_identity_tenant_grants
 add column scope_json jsonb not null default '{}' check(jsonb_typeof(scope_json)='object'),
 add column valid_from timestamptz not null default '-infinity',add column valid_until timestamptz,
 add constraint service_grant_period check(valid_until is null or valid_until>valid_from);
alter table public.api_clients rename column display_name to name;
alter table public.api_clients rename column client_key to client_id;
alter table public.api_clients
 add column client_type text not null default 'confidential' check(client_type in ('confidential','public','api_key')),
 add column secret_hash text,
 add column expires_at timestamptz,
 add column last_used_at timestamptz,
 add column created_by uuid references auth.users(id) on delete set null;
alter table public.api_client_permissions
 add column id uuid not null default gen_random_uuid() unique,
 add column condition_json jsonb not null default '{}' check(jsonb_typeof(condition_json)='object'),
 add column valid_from timestamptz not null default '-infinity',add column valid_until timestamptz,
 add constraint api_permission_period check(valid_until is null or valid_until>valid_from);
revoke select on public.api_clients from authenticated;
grant select(id,tenant_id,client_id,name,client_type,status,expires_at,last_used_at,created_by,created_at,updated_at) on public.api_clients to authenticated;

alter table public.permission_aliases enable row level security;
alter table public.role_templates enable row level security;
alter table public.role_template_permissions enable row level security;
revoke all on public.permission_aliases,public.role_templates,public.role_template_permissions from public,anon,authenticated;
grant select on public.permission_aliases,public.role_templates,public.role_template_permissions to authenticated;
create policy permission_alias_catalog on public.permission_aliases for select to authenticated using(true);
create policy role_template_catalog on public.role_templates for select to authenticated using(true);
create policy role_template_permission_catalog on public.role_template_permissions for select to authenticated using(true);
revoke all on function private.flexexa_seed_tenant_roles(),private.flexexa_enforce_role_scope() from public,anon,authenticated;
revoke all on function private.flexexa_canonical_permission(text) from public,anon;
grant execute on function private.flexexa_canonical_permission(text) to authenticated;
-- Replacing authorization functions preserves hardened ACLs; verified by pgTAP.
