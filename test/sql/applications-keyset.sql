-- Disposable database only. Uses the same configured test capability as applications.sql.
begin;
do $fixture$
declare
 actor uuid := gen_random_uuid();
begin
 insert into auth.users(id, email, email_confirmed_at)
 select actor, owner_email, now() from flexexa_acquisition.settings where singleton;
 perform public.flexexa_applications_admin('owner_login', current_setting('flexexa.test_secret'), actor);
 perform set_config('flexexa.test_owner', actor::text, true);
 insert into flexexa_acquisition.applications(
  email, first_name, last_name, annual_miles, car, offer_group, privacy_version, created_at, is_test
 )
 select 'keyset-' || i || '@example.invalid', 'Test', 'Keyset', 1, 'Testbil', 'test',
  'applications-2026-11-02-v1', '2026-11-26 08:30:01.123456+00', true
 from generate_series(1, 200) i;
end;
$fixture$;

set local role service_role;
do $test$
declare
 actor uuid := current_setting('flexexa.test_owner')::uuid;
 capability text := current_setting('flexexa.test_secret');
 first_page jsonb;
 next_page jsonb;
 legacy_page jsonb;
 continuation jsonb;
begin
 first_page := public.flexexa_applications_admin('admin_list', capability, actor);
 if jsonb_array_length(first_page->'applications') <> 100 or
    first_page#>>'{next,0}' is distinct from '2026-11-26T08:30:01.123456Z' then
  raise exception 'First page or timestamp precision is incorrect';
 end if;
 continuation := jsonb_build_object('after', jsonb_build_object(
  'created_at', first_page#>>'{next,0}', 'id', first_page#>>'{next,1}'
 ));
 next_page := public.flexexa_applications_admin('admin_list', capability, actor, continuation);
 legacy_page := public.flexexa_applications_admin('admin_list', capability, actor, '{"page":1}');
 if jsonb_array_length(next_page->'applications') <> 100 or next_page->'next' is distinct from 'null'::jsonb then
  raise exception 'An exact final page must have no continuation';
 end if;
 if next_page->'applications' is distinct from legacy_page->'applications' then
  raise exception 'Cursor skipped or duplicated rows at a shared timestamp';
 end if;
 if exists (
  select 1 from jsonb_array_elements(first_page->'applications') first
  join jsonb_array_elements(next_page->'applications') next on first->>'id' = next->>'id'
 ) then raise exception 'Cursor duplicated rows'; end if;
 begin
  perform public.flexexa_applications_admin('admin_list', capability, actor, continuation || '{"page":0}');
  raise exception 'Mixed pagination accepted';
 exception when invalid_parameter_value then null;
 end;
 begin
  perform public.flexexa_applications_admin('admin_list', capability, actor, '{"after":{"created_at":"yesterday","id":"bad"}}');
  raise exception 'Invalid marker accepted';
 exception when invalid_parameter_value then null;
 end;
end;
$test$;
reset role;
rollback;
select 'PASS: admin keyset precision, tie-breaking, legacy paging, final page and malformed cursor; rolled back' as result;
