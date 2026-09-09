-- Explicit binding of verified Supabase sessions to canonical machine identities.
-- No credentials/users/grants are provisioned and no resource endpoint is enabled.
alter table public.service_identity_tenant_grants
 add column id uuid not null default gen_random_uuid() unique;

create table private.flexexa_machine_principals (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid not null unique references auth.users(id),
 principal_type text not null check(principal_type in ('service','api_client')),
 service_identity_id uuid references public.service_identities(id),
 tenant_id uuid references public.tenants(id),
 api_client_id uuid,
 environment text not null check(environment in ('sandbox','production')),
 status text not null default 'active' check(status in ('active','suspended','revoked')),
 valid_from timestamptz not null default now(),
 valid_until timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint machine_principal_owner check(
  (principal_type='service' and service_identity_id is not null and tenant_id is null and api_client_id is null)
  or (principal_type='api_client' and service_identity_id is null and tenant_id is not null and api_client_id is not null)),
 constraint machine_principal_client_owner foreign key(tenant_id,api_client_id) references public.api_clients(tenant_id,id),
 constraint machine_principal_period check(isfinite(valid_from) and
  (valid_until is null or (isfinite(valid_until) and valid_until>valid_from)))
);
create index machine_principal_service_idx on private.flexexa_machine_principals(service_identity_id) where service_identity_id is not null;
create index machine_principal_client_idx on private.flexexa_machine_principals(tenant_id,api_client_id) where api_client_id is not null;
alter table private.flexexa_machine_principals enable row level security;
revoke all on private.flexexa_machine_principals from public,anon,authenticated;
comment on table private.flexexa_machine_principals is
 'Internal session-to-identity binding, not an API client/credential store. Provisioning requires a later audited privileged workflow. No browser access.';

create function private.flexexa_guard_machine_principal()
returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
  raise exception using errcode='23514',message='MACHINE_PRINCIPAL_DELETE_FORBIDDEN';
 end if;
 if (new.id,new.auth_user_id,new.principal_type,new.service_identity_id,new.tenant_id,new.api_client_id,new.environment,new.created_at,new.valid_from)
  is distinct from (old.id,old.auth_user_id,old.principal_type,old.service_identity_id,old.tenant_id,old.api_client_id,old.environment,old.created_at,old.valid_from) then
  raise exception using errcode='23514',message='MACHINE_PRINCIPAL_IDENTITY_IMMUTABLE';
 end if;
 if old.status='revoked' then
  if new is distinct from old then raise exception using errcode='23514',message='MACHINE_PRINCIPAL_REVOKED'; end if;
  return old;
 end if;
 new.updated_at=statement_timestamp();
 return new;
end $$;
create trigger machine_principal_immutable before update or delete on private.flexexa_machine_principals
 for each row execute function private.flexexa_guard_machine_principal();
revoke all on function private.flexexa_guard_machine_principal() from public,anon,authenticated;

-- Mapped machine users can never fall back to human/platform authorization,
-- including after binding suspension or revocation. Other human behavior is unchanged.
create or replace function private.flexexa_current_membership_id(p_tenant_id uuid)
returns uuid language sql stable security definer set search_path='' as $$
 select m.id from public.memberships m
 join public.tenants t on t.id=m.tenant_id and t.status='active'
 join public.organizations o on o.id=t.organization_id and o.status='active'
 where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active'
 and m.valid_from<=now() and (m.valid_until is null or m.valid_until>now())
 and coalesce(auth.jwt()->>'is_anonymous','false')='false'
 and not exists(select 1 from private.flexexa_machine_principals x where x.auth_user_id=auth.uid())
$$;
create or replace function private.flexexa_is_platform_admin()
returns boolean language sql stable security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'aal','')='aal2' and coalesce(auth.jwt()->>'is_anonymous','false')='false'
 and not exists(select 1 from private.flexexa_machine_principals x where x.auth_user_id=auth.uid())
 and exists(select 1 from public.platform_memberships pm join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
 join public.roles r on r.id=pmr.role_id where pm.user_id=auth.uid() and pm.status='active'
 and r.scope_type='platform' and r.status='active' and r.role_key in ('platform_admin','superadmin'))
$$;

create function private.flexexa_machine_has_permission(p_tenant_id uuid,p_permission_key text,p_environment text)
returns boolean language sql stable security definer set search_path='' as $$
 with context as (
  select auth.uid() actor_id,auth.jwt() claims,statement_timestamp() at
 ), identity as (
  select b.*,c.at from context c
  join private.flexexa_machine_principals b on b.auth_user_id=c.actor_id
  join auth.users u on u.id=c.actor_id and u.deleted_at is null and u.is_anonymous=false
   and (u.banned_until is null or u.banned_until<=c.at)
  join auth.sessions s on s.user_id=c.actor_id and s.id=(case
   when length(c.claims->>'session_id')=36 and (c.claims->>'session_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
   then (c.claims->>'session_id')::uuid else null end)
   and (s.not_after is null or s.not_after>c.at)
  join public.tenants t on t.id=p_tenant_id and t.status='active'
  join public.organizations o on o.id=t.organization_id and o.status='active'
  where c.claims->>'role'='authenticated' and coalesce(c.claims->>'is_anonymous','false')='false'
   and b.status='active' and b.environment=p_environment and p_environment in ('sandbox','production')
   and b.valid_from<=c.at and (b.valid_until is null or b.valid_until>c.at)
   and not exists(select 1 from public.memberships m where m.user_id=c.actor_id)
   and not exists(select 1 from public.platform_memberships m where m.user_id=c.actor_id)
 ), target as (
  select p.* from public.permissions p
  where p.permission_key=private.flexexa_canonical_permission(p_permission_key)
   and p.status='active' and p.scope_type='tenant' and not p.requires_mfa and not p.requires_step_up
 )
 select exists(
  select 1 from identity i cross join target t
  join public.service_identity_tenant_grants g on g.tenant_id=p_tenant_id
  join public.service_identities s on s.id=g.service_identity_id and s.status='active'
  join public.permissions gp on gp.id=g.permission_id and gp.status<>'retired'
  where i.principal_type='service' and i.service_identity_id=s.id
   and private.flexexa_canonical_permission(gp.permission_key)=t.permission_key
   and g.valid_from<=i.at and (g.valid_until is null or g.valid_until>i.at)
   and g.scope_json=jsonb_build_object('environment',p_environment)
  union all
  select 1 from identity i cross join target t
  join public.api_client_permissions g on g.tenant_id=p_tenant_id
  join public.api_clients a on a.id=g.api_client_id and a.tenant_id=g.tenant_id and a.status='active'
  join public.permissions gp on gp.id=g.permission_id and gp.status<>'retired'
  where i.principal_type='api_client' and i.tenant_id=p_tenant_id and i.api_client_id=a.id
   and a.client_type in ('confidential','api_key') and (a.expires_at is null or a.expires_at>i.at)
   and private.flexexa_canonical_permission(gp.permission_key)=t.permission_key
   and g.valid_from<=i.at and (g.valid_until is null or g.valid_until>i.at)
   and g.condition_json=jsonb_build_object('environment',p_environment)
 )
$$;
comment on function private.flexexa_machine_has_permission(uuid,text,text) is
 'Current-statement preflight only. Verified bearer/session required. Environment-only scopes supported; all other conditions and MFA/step-up fail closed. Future resource RPCs must independently authorize within their transaction.';
create function public.flexexa_machine_has_permission(p_tenant_id uuid,p_permission_key text,p_environment text)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.flexexa_machine_has_permission(p_tenant_id,p_permission_key,p_environment)
$$;
revoke all on function private.flexexa_machine_has_permission(uuid,text,text) from public,anon,authenticated;
revoke all on function public.flexexa_machine_has_permission(uuid,text,text) from public,anon,authenticated;
grant execute on function private.flexexa_machine_has_permission(uuid,text,text) to authenticated;
grant execute on function public.flexexa_machine_has_permission(uuid,text,text) to authenticated;
