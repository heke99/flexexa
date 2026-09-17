begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select no_plan();
create function pg_temp.fid(n integer) returns uuid language sql immutable as $$
 select ('aa900000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid
$$;
create function pg_temp.bind(p jsonb default '{}') returns void language sql as $$
 insert into public.asset_connections(tenant_id,customer_id,asset_id,provider_account_id,provider_id,environment,external_asset_id,connection_type,capabilities_json,valid_from,valid_until,status)
 select pg_temp.fid(coalesce((p->>'tenant')::int,20)),pg_temp.fid(coalesce((p->>'customer')::int,40)),
 pg_temp.fid(coalesce((p->>'asset')::int,60)),pg_temp.fid(coalesce((p->>'account')::int,70)),id,
 coalesce(p->>'environment','sandbox'),coalesce(p->>'external','new-external'),'aggregated_api',
 coalesce(p->'capabilities','[]'::jsonb),coalesce((p->>'start')::timestamptz,'2026-01-01'),
 (p->>'end')::timestamptz,coalesce(p->>'status','pending') from public.integration_providers where key=coalesce(p->>'provider','enode')
$$;
create temp table route_results(body jsonb);
grant all on route_results to authenticated;
insert into auth.users(id,email) values(pg_temp.fid(1),'connect-admin@example.invalid'),(pg_temp.fid(2),'connect-viewer@example.invalid');
insert into public.organizations(id,name,slug) values(pg_temp.fid(10),'Connect','connect-test');
insert into public.tenants(id,organization_id,name,slug) select pg_temp.fid(n),pg_temp.fid(10),'Connect '||n,'connect-'||n from generate_series(20,21) n;
insert into public.memberships(id,tenant_id,user_id) values(pg_temp.fid(30),pg_temp.fid(20),pg_temp.fid(1)),(pg_temp.fid(31),pg_temp.fid(20),pg_temp.fid(2));
insert into public.membership_roles(tenant_id,membership_id,role_id) select pg_temp.fid(20),pg_temp.fid(x.m),r.id from (values(30,'tenant_admin'),(31,'viewer')) x(m,k) join public.roles r on r.tenant_id=pg_temp.fid(20) and r.role_key=x.k;
insert into public.customers(id,tenant_id,customer_type,display_name) select pg_temp.fid(n),pg_temp.fid(case when n=42 then 21 else 20 end),'person','Connect '||n from generate_series(40,42) n;
insert into public.sites(id,tenant_id,customer_id,name) select pg_temp.fid(n+10),pg_temp.fid(case when n=42 then 21 else 20 end),pg_temp.fid(n),'Site '||n from generate_series(40,42) n;
insert into public.assets(id,tenant_id,customer_id,site_id,asset_type,display_name) select pg_temp.fid(n+20),pg_temp.fid(case when n=42 then 21 else 20 end),pg_temp.fid(n),pg_temp.fid(n+10),'ev','Asset '||n from generate_series(40,42) n;
update public.integration_providers set status='active' where key in ('enode','ocpp');
insert into public.provider_accounts(id,tenant_id,customer_id,provider_id,environment,external_account_id,credential_reference,connection_status)
 select pg_temp.fid(x.n),pg_temp.fid(x.t),pg_temp.fid(x.c),p.id,x.env,'upstream-account','vault://fixture/not-a-secret','connected'
 from (values(70,20,40,'enode','sandbox'),(71,20,40,'enode','production'),(72,20,40,'ocpp','sandbox'),(73,21,42,'enode','sandbox')) x(n,t,c,k,env)
 join public.integration_providers p on p.key=x.k;
insert into public.asset_connections(id,tenant_id,customer_id,asset_id,provider_account_id,provider_id,environment,external_asset_id,connection_type,status,capabilities_json,capabilities_verified_at,health,last_seen_at,state_observed_at,valid_from)
 select pg_temp.fid(x.n+10),a.tenant_id,a.customer_id,pg_temp.fid(x.asset),a.id,a.provider_id,a.environment,'upstream-asset',x.kind,'connected','["read_soc","start_charge"]','2026-09-09T12:00:00Z','healthy','2026-09-09T12:00:00Z','2026-09-09T11:00:00Z','2026-01-01'
 from (values(70,60,'aggregated_api'),(71,60,'aggregated_api'),(72,60,'ocpp'),(73,62,'aggregated_api')) x(n,asset,kind) join public.provider_accounts a on a.id=pg_temp.fid(x.n);
select is((select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('integration_providers','provider_accounts','asset_connections') and c.relrowsecurity),3::bigint,'registry tables have RLS');
select ok(not has_column_privilege('authenticated','public.provider_accounts','credential_reference','SELECT'),'secret references excluded from browser grants');
select ok(not has_function_privilege('anon','public.flexexa_get_connection_routes(uuid,uuid,text)','EXECUTE'),'anonymous route RPC denied');
select ok(not (select prosecdef from pg_proc where oid='public.flexexa_get_connection_routes(uuid,uuid,text)'::regprocedure),'route read preserves invoker RLS');
select throws_ok($$select pg_temp.bind('{"asset":62}')$$,'23503',null,'other tenant asset rejected');
select throws_ok($$select pg_temp.bind('{"asset":61}')$$,'23503',null,'other customer asset rejected');
select throws_ok($$select pg_temp.bind('{"asset":61,"customer":41}')$$,'23503',null,'other customer account rejected');
select throws_ok($$select pg_temp.bind('{"account":73}')$$,'23503',null,'other tenant account rejected');
select throws_ok($$select pg_temp.bind('{"provider":"ocpp"}')$$,'23503',null,'provider disagreement rejected');
select throws_ok($$select pg_temp.bind('{"environment":"production"}')$$,'23503',null,'sandbox production disagreement rejected');
select throws_ok($$select pg_temp.bind('{"external":"upstream-asset"}')$$,'23P01',null,'overlapping upstream binding rejected');
select throws_ok($$select pg_temp.bind('{"capabilities":{}}')$$,'23514',null,'non-array capabilities rejected');
select throws_ok($$select pg_temp.bind('{"capabilities":["start_charge","start_charge"]}')$$,'23514',null,'duplicate capabilities rejected');
select throws_ok($$select pg_temp.bind('{"capabilities":["administrator"]}')$$,'23514',null,'unknown capabilities rejected');
select throws_ok($$select pg_temp.bind('{"capabilities":[null]}')$$,'23514',null,'null capability rejected');
select throws_ok($$select pg_temp.bind('{"capabilities":[1]}')$$,'23514',null,'non-string capability rejected');
select throws_ok($$select pg_temp.bind('{"end":"2026-01-01"}')$$,'23514',null,'empty half-open period rejected');
select throws_ok($$select pg_temp.bind('{"status":"revoked"}')$$,'23514',null,'revocation requires closed provenance');
select throws_ok($$select pg_temp.bind('{"external":"\u00a0asset"}')$$,'23514',null,'Unicode leading whitespace is not a canonical external ID');
select throws_ok($$select pg_temp.bind('{"start":"infinity"}')$$,'23514',null,'infinite timestamp rejected');
select throws_ok($$update public.provider_accounts set environment='production' where id=pg_temp.fid(70)$$,'23514','CONNECT_IDENTITY_IMMUTABLE','account environment immutable');
select throws_ok($$update public.provider_accounts set customer_id=pg_temp.fid(41) where id=pg_temp.fid(70)$$,'23514','CONNECT_IDENTITY_IMMUTABLE','account owner immutable');
select throws_ok($$update public.asset_connections set asset_id=pg_temp.fid(61) where id=pg_temp.fid(80)$$,'23514','CONNECT_IDENTITY_IMMUTABLE','canonical binding cannot be reassigned');
select throws_ok($$delete from public.customers where id=pg_temp.fid(40)$$,'23503',null,'customer deletion cannot orphan bindings');
select throws_ok($$delete from public.asset_connections where id=pg_temp.fid(80)$$,'23514','CONNECT_HISTORY_IMMUTABLE','history cannot disappear');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fid(1),'role','authenticated','aal','aal1')::text,true);
select is((select count(id) from public.provider_accounts),3::bigint,'own tenant accounts only');
select is((select count(*) from public.asset_connections),3::bigint,'own tenant connections only');
select throws_ok($$select credential_reference from public.provider_accounts$$,'42501',null,'credential references unreadable');
select throws_ok($$select * from public.provider_accounts$$,'42501',null,'wildcard cannot expose credential references');
select throws_ok($$select pg_temp.bind()$$,'42501',null,'browser cannot bind directly');
select throws_ok($$update public.integration_providers set status='active'$$,'42501',null,'tenant cannot enable providers');
insert into route_results select public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),'sandbox');
select is((select jsonb_array_length(body) from route_results),2,'sandbox joins Enode and first-party');
select is(jsonb_array_length(public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),'production')),1,'production routes separate');
select is((select count(*) from route_results,jsonb_array_elements(body) r where r->>'environment'='sandbox'),2::bigint,'every route retains environment');
select is((select count(*) from route_results,jsonb_array_elements(body) r where r->>'provider_key'='ocpp'),1::bigint,'first-party route independent');
select is((select body->0->>'state_observed_at' from route_results),'2026-09-09T11:00:00.000Z','UTC output preserves stale observation');
select ok((select not body::text like '%credential_reference%' and not body::text like '%vault://%' from route_results),'no secret metadata in route');
select throws_ok($$select public.flexexa_get_connection_routes(pg_temp.fid(21),pg_temp.fid(62),'sandbox')$$,'42501','PERMISSION_DENIED','other tenant scope denied');
select is(public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(62),'sandbox'),'[]'::jsonb,'other tenant asset never resolves');
select throws_ok($$select public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),null)$$,'P0001','VALIDATION_ERROR','missing environment rejected');
select throws_ok($$select public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),'dev')$$,'P0001','VALIDATION_ERROR','unknown environment rejected');
reset role;
update public.customers set status='archived' where id=pg_temp.fid(40);
set local role authenticated;
select is(public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),'sandbox'),'[]'::jsonb,'archived owner loses routes');
reset role;
update public.customers set status='active' where id=pg_temp.fid(40);
update public.provider_accounts set connection_status='revoked' where id=pg_temp.fid(70);
select throws_ok($$update public.provider_accounts set connection_status='connected' where id=pg_temp.fid(70)$$,'23514','INVALID_STATE_TRANSITION','revoked account cannot reactivate');
set local role authenticated;
select is(public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),'sandbox')->0->>'account_status','revoked','revocation retained for Kernel rejection');
reset role;
update public.asset_connections set status='revoked',valid_until='2026-09-01' where id=pg_temp.fid(80);
select throws_ok($$update public.asset_connections set status='connected' where id=pg_temp.fid(80)$$,'23514','INVALID_STATE_TRANSITION','revoked connection cannot reactivate');
select throws_ok($$update public.asset_connections set valid_until=null where id=pg_temp.fid(80)$$,'23514','CONNECT_HISTORY_IMMUTABLE','closed binding cannot reopen');
select lives_ok($$select pg_temp.bind('{"external":"upstream-asset","start":"2026-09-01"}')$$,'nonoverlapping successor preserves history');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fid(2),'role','authenticated','aal','aal1')::text,true);
select throws_ok($$select public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),'sandbox')$$,'42501','PERMISSION_DENIED','viewer lacks integration permission');
select is((select count(*) from public.asset_connections),0::bigint,'viewer RLS hides connections');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.fid(1),'role','authenticated','aal','aal1','is_anonymous',true)::text,true);
select throws_ok($$select public.flexexa_get_connection_routes(pg_temp.fid(20),pg_temp.fid(60),'sandbox')$$,'42501','PERMISSION_DENIED','anonymous sign-in denied');
reset role;
select is((select count(*) from public.outbox_events),0::bigint,'inventory test sends no commands');
select * from finish();
rollback;
