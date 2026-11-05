-- Read-only asset inventory; no plans, writes to customer data or device commands.
create function private.flexexa_assert_charging_reader() returns void
language plpgsql volatile security definer set search_path='' as $$
begin
 if coalesce(auth.jwt()->>'role','')<>'authenticated' or coalesce(auth.jwt()->>'is_anonymous','false')<>'false'
 or exists(select 1 from private.flexexa_machine_principals where auth_user_id=auth.uid()) then
  raise exception using errcode='42501',message='PERMISSION_DENIED';
 end if;
 perform 1 from auth.users u join auth.sessions s on s.user_id=u.id
 where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and u.deleted_at is null
 and u.is_anonymous=false and (u.banned_until is null or u.banned_until<=clock_timestamp())
 and (s.not_after is null or s.not_after>clock_timestamp()) for share of u,s;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
end $$;
revoke all on function private.flexexa_assert_charging_reader() from public,anon,authenticated,service_role;
grant execute on function private.flexexa_assert_charging_reader() to authenticated;

create function public.flexexa_charging_inventory(p_tenant_id uuid) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare rows jsonb; more boolean;
begin
 perform private.flexexa_assert_charging_reader();
 perform private.flexexa_assert_permission(p_tenant_id,'assets.read');
 -- Invoker SELECT preserves canonical asset RLS as a second independent boundary.
 select coalesce(jsonb_agg(jsonb_build_object('asset_id',a.id,'site_id',a.site_id,'label',a.display_name,
  'status',a.status,'asset_type',a.asset_type) order by a.id),'[]'::jsonb) into rows
 from (select * from public.assets where tenant_id=p_tenant_id and asset_type in ('ev','evse') order by id limit 100) a;
 select exists(select 1 from public.assets where tenant_id=p_tenant_id and asset_type in ('ev','evse') order by id offset 100 limit 1) into more;
 return jsonb_build_object('tenant_id',p_tenant_id,'generated_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),'mode','live','assets',rows,'has_more',more);
end $$;
revoke all on function public.flexexa_charging_inventory(uuid) from public,anon,authenticated,service_role;
grant execute on function public.flexexa_charging_inventory(uuid) to authenticated;

create function public.flexexa_platform_charging_inventory(p_correlation_id uuid) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare rows jsonb; response jsonb; receipt uuid:=gen_random_uuid(); resource uuid:=gen_random_uuid();
begin
 perform private.flexexa_assert_charging_reader();
 perform private.flexexa_assert_policy_admin(); -- live MFA + platform role, held locks
 perform private.flexexa_input_uuid(jsonb_build_object('id',p_correlation_id),'id');
 select coalesce(jsonb_agg(jsonb_build_object('tenant_id',t.id,'label',t.name,'asset_count',
  (select count(*) from public.assets a where a.tenant_id=t.id and a.asset_type in ('ev','evse'))) order by t.id),'[]'::jsonb) into rows
 from (select id,name from public.tenants where status='active' order by id limit 1000) t;
 response:=jsonb_build_object('generated_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'mode','live','companies',rows,'has_more',(select count(*)>1000 from public.tenants where status='active'));
 -- One canonical receipt and audit event in the same transaction as this read.
 insert into public.idempotency_records(scope_type,tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,
  response_reference,response_json,status,correlation_id)
 values('platform',null,'user',auth.uid(),'platform_charging_inventory',receipt::text,
  encode(extensions.digest('{}','sha256'),'hex'),resource,response,'completed',p_correlation_id)
 returning id into receipt;
 insert into public.audit_events(scope_type,tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
 values('platform',null,'user',auth.uid(),'platform_charging_inventory','charging_inventory',resource,p_correlation_id,receipt,
  jsonb_build_object('company_count',jsonb_array_length(rows)));
 return response;
end $$;
revoke all on function public.flexexa_platform_charging_inventory(uuid) from public,anon,authenticated,service_role;
grant execute on function public.flexexa_platform_charging_inventory(uuid) to authenticated;
