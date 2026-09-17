-- Forward-only hardening. Existing applied migrations are not rewritten.
-- Promoted to supabase/migrations with a CLI-generated version after replay tests.
create or replace function private.flexexa_current_membership_id(p_tenant_id uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select m.id from public.memberships m
  join public.tenants t on t.id=m.tenant_id and t.status='active'
  join public.organizations o on o.id=t.organization_id and o.status='active'
  where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active'
    and coalesce(auth.jwt()->>'is_anonymous','false')='false'
$$;

create or replace function private.flexexa_is_tenant_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select private.flexexa_current_membership_id(p_tenant_id) is not null $$;

create or replace function private.flexexa_has_role(p_tenant_id uuid,p_role_key text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id
    where mr.tenant_id=p_tenant_id
      and mr.membership_id=private.flexexa_current_membership_id(p_tenant_id)
      and r.scope='tenant' and r.role_key=lower(p_role_key)
  )
$$;

-- Platform membership is not a blanket tenant-data grant. Sensitive platform
-- operations require MFA; a scoped, audited break-glass path is a later phase.
create or replace function private.flexexa_is_platform_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt()->>'aal','')='aal2'
    and coalesce(auth.jwt()->>'is_anonymous','false')='false'
    and exists (
      select 1 from public.platform_memberships pm
      join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
      join public.roles r on r.id=pmr.role_id
      where pm.user_id=auth.uid() and pm.status='active' and r.scope='platform'
        and r.role_key in ('platform_admin','superadmin')
    )
$$;
create or replace function private.flexexa_is_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt()->>'aal','')='aal2'
    and coalesce(auth.jwt()->>'is_anonymous','false')='false'
    and exists (
      select 1 from public.platform_memberships pm
      join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
      join public.roles r on r.id=pmr.role_id
      where pm.user_id=auth.uid() and pm.status='active' and r.scope='platform'
        and r.role_key='superadmin'
    )
$$;

create or replace function private.flexexa_has_permission(p_tenant_id uuid,p_permission_key text)
returns boolean language sql stable security definer set search_path = ''
as $$
  with membership as (
    select private.flexexa_current_membership_id(p_tenant_id) as id
  ), permission as (
    select id from public.permissions where permission_key=lower(p_permission_key)
  )
  select coalesce((
    select case
      when exists(select 1 from public.membership_permission_overrides x
        where x.tenant_id=p_tenant_id and x.membership_id=m.id
          and x.permission_id=p.id and x.effect='deny') then false
      when exists(select 1 from public.membership_permission_overrides x
        where x.tenant_id=p_tenant_id and x.membership_id=m.id
          and x.permission_id=p.id and x.effect='allow') then true
      else exists(select 1 from public.membership_roles mr
        join public.roles r on r.id=mr.role_id and r.scope='tenant'
        join public.role_permissions rp on rp.role_id=r.id and rp.permission_id=p.id
        where mr.tenant_id=p_tenant_id and mr.membership_id=m.id)
    end
    from membership m cross join permission p where m.id is not null
  ),false)
$$;

create or replace function private.flexexa_effective_permissions(p_tenant_id uuid)
returns setof text language sql stable security definer set search_path = ''
as $$
  select p.permission_key from public.permissions p
  where private.flexexa_has_permission(p_tenant_id,p.permission_key)
  order by p.permission_key
$$;
create or replace function private.flexexa_assert_permission(p_tenant_id uuid,p_permission_key text)
returns void language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.flexexa_has_permission(p_tenant_id,p_permission_key) then
    raise exception using errcode='42501',message='PERMISSION_DENIED';
  end if;
end
$$;

create function private.flexexa_enforce_role_scope()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare role_scope text;
begin
  select r.scope into role_scope from public.roles r where r.id=new.role_id;
  if role_scope is null then
    raise exception using errcode='23503',message='ROLE_NOT_FOUND';
  end if;
  if (tg_table_name='membership_roles' and role_scope<>'tenant')
    or (tg_table_name='platform_membership_roles' and role_scope<>'platform') then
    raise exception using errcode='23514',message='ROLE_SCOPE_MISMATCH';
  end if;
  return new;
end
$$;
create trigger membership_role_scope before insert or update on public.membership_roles
for each row execute function private.flexexa_enforce_role_scope();
create trigger platform_role_scope before insert or update on public.platform_membership_roles
for each row execute function private.flexexa_enforce_role_scope();

do $$ begin
  if exists(select 1 from public.membership_roles mr join public.roles r on r.id=mr.role_id where r.scope<>'tenant')
    or exists(select 1 from public.platform_membership_roles mr join public.roles r on r.id=mr.role_id where r.scope<>'platform') then
    raise exception 'ROLE_SCOPE_MISMATCH: repair assignments before continuing';
  end if;
end $$;

-- A moved function keeps explicit grants: revoke anon, not just PUBLIC.
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public,anon;
revoke all on function private.flexexa_enforce_role_scope() from authenticated;
-- Only established authorization helpers remain callable by authenticated.
grant execute on function private.flexexa_current_membership_id(uuid),
 private.flexexa_is_tenant_member(uuid),private.flexexa_has_role(uuid,text),
 private.flexexa_is_platform_admin(),private.flexexa_is_superadmin(),
 private.flexexa_has_permission(uuid,text),private.flexexa_effective_permissions(uuid),
 private.flexexa_assert_permission(uuid,text) to authenticated;
