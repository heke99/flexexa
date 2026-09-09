grant usage on schema private to authenticated;

alter function public.flexexa_is_tenant_member(uuid) set schema private;
alter function public.flexexa_has_role(uuid, text) set schema private;
alter function public.flexexa_is_platform_admin() set schema private;
alter function public.flexexa_is_superadmin() set schema private;
alter function public.flexexa_has_permission(uuid, text) set schema private;
alter function public.flexexa_effective_permissions(uuid) set schema private;
alter function public.flexexa_assert_permission(uuid, text) set schema private;

create or replace function private.flexexa_is_tenant_member(p_tenant_id uuid)
returns boolean language sql stable security definer
set search_path = public, auth, private, pg_temp
as $$
  select exists (
    select 1 from public.memberships m
    where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active'
  )
$$;

create or replace function private.flexexa_has_role(p_tenant_id uuid, p_role_key text)
returns boolean language sql stable security definer
set search_path = public, auth, private, pg_temp
as $$
  select exists (
    select 1
    from public.memberships m
    join public.membership_roles mr on mr.tenant_id=m.tenant_id and mr.membership_id=m.id
    join public.roles r on r.id=mr.role_id
    where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active'
      and r.role_key=lower(p_role_key) and r.scope='tenant'
  )
$$;

create or replace function private.flexexa_is_platform_admin()
returns boolean language sql stable security definer
set search_path = public, auth, private, pg_temp
as $$
  select exists (
    select 1
    from public.platform_memberships pm
    join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
    join public.roles r on r.id=pmr.role_id
    where pm.user_id=auth.uid() and pm.status='active'
      and r.role_key in ('superadmin','platform_admin') and r.scope='platform'
  )
$$;

create or replace function private.flexexa_is_superadmin()
returns boolean language sql stable security definer
set search_path = public, auth, private, pg_temp
as $$
  select exists (
    select 1
    from public.platform_memberships pm
    join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
    join public.roles r on r.id=pmr.role_id
    where pm.user_id=auth.uid() and pm.status='active'
      and r.role_key='superadmin' and r.scope='platform'
  )
$$;

create or replace function private.flexexa_has_permission(p_tenant_id uuid, p_permission_key text)
returns boolean language sql stable security definer
set search_path = public, auth, private, pg_temp
as $$
  with current_membership as (
    select m.id from public.memberships m
    where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active' limit 1
  ),
  target_permission as (
    select p.id from public.permissions p where p.permission_key=lower(p_permission_key) limit 1
  ),
  override_effect as (
    select mpo.effect
    from current_membership cm
    join target_permission tp on true
    join public.membership_permission_overrides mpo
      on mpo.tenant_id=p_tenant_id and mpo.membership_id=cm.id and mpo.permission_id=tp.id
    limit 1
  ),
  role_allow as (
    select exists (
      select 1
      from current_membership cm
      join public.membership_roles mr on mr.tenant_id=p_tenant_id and mr.membership_id=cm.id
      join public.role_permissions rp on rp.role_id=mr.role_id
      join target_permission tp on tp.id=rp.permission_id
    ) as allowed
  )
  select case
    when private.flexexa_is_platform_admin() then true
    when exists (select 1 from override_effect where effect='deny') then false
    when exists (select 1 from override_effect where effect='allow') then true
    else coalesce((select allowed from role_allow),false)
  end
$$;

create or replace function private.flexexa_effective_permissions(p_tenant_id uuid)
returns setof text language sql stable security definer
set search_path = public, auth, private, pg_temp
as $$
  with current_membership as (
    select m.id from public.memberships m
    where m.tenant_id=p_tenant_id and m.user_id=auth.uid() and m.status='active' limit 1
  ),
  role_perms as (
    select distinct p.permission_key,p.id
    from current_membership cm
    join public.membership_roles mr on mr.tenant_id=p_tenant_id and mr.membership_id=cm.id
    join public.role_permissions rp on rp.role_id=mr.role_id
    join public.permissions p on p.id=rp.permission_id
  ),
  allows as (
    select p.permission_key,p.id
    from current_membership cm
    join public.membership_permission_overrides mpo
      on mpo.tenant_id=p_tenant_id and mpo.membership_id=cm.id and mpo.effect='allow'
    join public.permissions p on p.id=mpo.permission_id
  ),
  denies as (
    select mpo.permission_id
    from current_membership cm
    join public.membership_permission_overrides mpo
      on mpo.tenant_id=p_tenant_id and mpo.membership_id=cm.id and mpo.effect='deny'
  ),
  combined as (
    select * from role_perms
    union
    select * from allows
  )
  select c.permission_key
  from combined c
  where not exists (select 1 from denies d where d.permission_id=c.id)
  union
  select p.permission_key from public.permissions p where private.flexexa_is_platform_admin()
$$;

create or replace function private.flexexa_assert_permission(p_tenant_id uuid, p_permission_key text)
returns void language plpgsql stable security definer
set search_path = public, auth, private, pg_temp
as $$
begin
  if not private.flexexa_has_permission(p_tenant_id,p_permission_key) then
    raise exception using errcode='42501', message='PERMISSION_DENIED',
      detail=format('permission=%s tenant=%s',p_permission_key,p_tenant_id);
  end if;
end
$$;

revoke all on all functions in schema private from public;
grant execute on function private.flexexa_current_membership_id(uuid) to authenticated;
grant execute on function private.flexexa_is_tenant_member(uuid) to authenticated;
grant execute on function private.flexexa_has_role(uuid,text) to authenticated;
grant execute on function private.flexexa_is_platform_admin() to authenticated;
grant execute on function private.flexexa_is_superadmin() to authenticated;
grant execute on function private.flexexa_has_permission(uuid,text) to authenticated;
grant execute on function private.flexexa_effective_permissions(uuid) to authenticated;
grant execute on function private.flexexa_assert_permission(uuid,text) to authenticated;
