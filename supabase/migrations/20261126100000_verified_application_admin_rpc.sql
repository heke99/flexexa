-- The web server validates the user token with Supabase Auth before passing the
-- actor UUID. The database still checks the current membership on every read.
create function public.flexexa_applications_admin(p_action text, p_secret text, p_actor uuid, p_data jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
 s flexexa_acquisition.settings%rowtype;
 v_member uuid;
 v_role uuid;
 v_page integer;
begin
 select * into s from flexexa_acquisition.settings where singleton;
 if p_actor is null or s.secret_hash is null
   or encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex') <> s.secret_hash
 then raise exception 'ACCESS_DENIED' using errcode = '42501'; end if;

 if p_action = 'owner_login' then
  if not exists (
   select 1 from auth.users u
   where u.id = p_actor and lower(u.email) = s.owner_email and u.email_confirmed_at is not null
  ) then raise exception 'ACCESS_DENIED' using errcode = '42501'; end if;

  -- Serialize the one-time bootstrap and never reactivate an existing member.
  perform pg_advisory_xact_lock(hashtextextended(p_actor::text, 8812));
  select id into v_member from public.platform_memberships where user_id = p_actor;
  if v_member is null then
   select id into v_role from public.roles
   where role_key = 'superadmin' and scope_type = 'platform' and status = 'active';
   if v_role is null then raise exception 'ROLE_NOT_READY'; end if;
   insert into public.platform_memberships(user_id, status) values(p_actor, 'active') returning id into v_member;
   insert into public.platform_membership_roles(platform_membership_id, role_id) values(v_member, v_role);
   insert into flexexa_acquisition.events(action, actor_id) values('owner.bootstrap', p_actor);
  end if;
  return jsonb_build_object('ok', true);
 end if;

 if p_action <> 'admin_list' or p_action is null then
  raise exception 'UNKNOWN_OPERATION' using errcode = '22023';
 end if;
 if not exists (
  select 1 from public.platform_memberships m
  join public.platform_membership_roles mr on mr.platform_membership_id = m.id
  join public.roles r on r.id = mr.role_id
  where m.user_id = p_actor and m.status = 'active'
   and r.status = 'active' and r.scope_type = 'platform' and r.role_key = 'superadmin'
 ) then raise exception 'ACCESS_DENIED' using errcode = '42501'; end if;

 v_page := coalesce((p_data->>'page')::integer, 0);
 if v_page < 0 or v_page > 100 then raise exception 'INVALID_PAGE' using errcode = '22023'; end if;
 insert into flexexa_acquisition.events(action, actor_id) values('applications.read', p_actor);

 return jsonb_build_object(
  'count', 93 + s.new_count, 'base', 93, 'new', s.new_count,
  'applications', coalesce((
   select jsonb_agg(to_jsonb(q) order by q.created_at desc, q.id desc)
   from (
    select a.*, j.state as email_state, j.provider_id, j.last_error, j.attempts
    from flexexa_acquisition.applications a
    left join flexexa_acquisition.email_jobs j on j.application_id = a.id
    order by a.created_at desc, a.id desc limit 100 offset v_page * 100
   ) q
  ), '[]'::jsonb)
 );
end;
$$;

revoke all on function public.flexexa_applications_admin(text, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.flexexa_applications_admin(text, text, uuid, jsonb) to service_role;
