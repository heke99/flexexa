create function public.flexexa_charging_companies() returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare rows jsonb;
begin
 perform private.flexexa_assert_charging_reader();
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name) order by t.id),'[]'::jsonb) into rows
 from (select id,name from public.tenants where private.flexexa_has_permission(id,'assets.read') order by id limit 100) t;
 return rows;
end $$;
revoke all on function public.flexexa_charging_companies() from public,anon,authenticated,service_role;
grant execute on function public.flexexa_charging_companies() to authenticated;
