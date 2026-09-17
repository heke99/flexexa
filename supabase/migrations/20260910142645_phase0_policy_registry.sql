-- Canonical global rules and tenant-owned bindings/readiness. No executable SQL,
-- JavaScript or LLM expression is accepted by the initial power-policy language.
create table public.rule_definitions (
 id uuid primary key default gen_random_uuid(),
 rule_key text not null unique check(rule_key ~ '^[a-z][a-z0-9_.]{0,119}$'),
 domain text not null, name text not null, description text not null default '',
 scope_type text not null check(scope_type in ('platform','country','market_area','market_provider','market_product','market_actor','tenant','site','asset_type','asset','customer','portfolio')),
 rule_type text not null, input_schema_json jsonb not null check(jsonb_typeof(input_schema_json)='object'),
 output_schema_json jsonb not null check(jsonb_typeof(output_schema_json)='object'),
 default_effect text not null check(default_effect in ('deny','limit')),
 overridable_by_tenant boolean not null default false,
 criticality text not null check(criticality in ('normal','high','critical')),
 execution_mode text not null check(execution_mode='deterministic'),
 status text not null default 'active' check(status in ('active','retired')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.rule_versions (
 id uuid primary key default gen_random_uuid(),
 rule_definition_id uuid not null references public.rule_definitions(id) on delete restrict,
 version integer not null check(version>0),
 expression_language text not null check(expression_language='flexexa.power.v1'),
 expression_json jsonb not null check(jsonb_typeof(expression_json)='object'),
 configuration_json jsonb not null default '{}' check(jsonb_typeof(configuration_json)='object'),
 checksum text not null check(checksum ~ '^[0-9a-f]{64}$'),
 status text not null default 'draft' check(status in ('draft','testing','approved','published','deprecated','retired')),
 valid_from timestamptz not null, valid_until timestamptz not null,
 created_by uuid not null, approved_by uuid, approved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(rule_definition_id,version), unique(rule_definition_id,id),
 check(isfinite(valid_from) and isfinite(valid_until) and valid_until>valid_from),
 check((status in ('draft','testing') and approved_by is null and approved_at is null)
  or (status in ('approved','published','deprecated','retired') and approved_by is not null and approved_by<>created_by and approved_at is not null))
);
create table public.policy_sets (
 id uuid primary key default gen_random_uuid(),
 policy_key text not null unique check(policy_key ~ '^[a-z][a-z0-9_.]{0,119}$'),
 domain text not null, name text not null, description text not null default '',
 criticality text not null check(criticality in ('normal','high','critical')),
 status text not null default 'active' check(status in ('active','retired')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.policy_set_versions (
 id uuid primary key default gen_random_uuid(),
 policy_set_id uuid not null references public.policy_sets(id) on delete restrict,
 version integer not null check(version>0),
 status text not null default 'draft' check(status in ('draft','testing','approved','published','deprecated','retired')),
 checksum text not null check(checksum ~ '^[0-9a-f]{64}$'),
 valid_from timestamptz not null, valid_until timestamptz not null,
 created_by uuid not null, approved_by uuid, approved_at timestamptz,
 created_at timestamptz not null default now(),
 unique(policy_set_id,version), unique(policy_set_id,id),
 check(isfinite(valid_from) and isfinite(valid_until) and valid_until>valid_from),
 check((status in ('draft','testing') and approved_by is null and approved_at is null)
  or (status in ('approved','published','deprecated','retired') and approved_by is not null and approved_by<>created_by and approved_at is not null))
);
create table public.policy_set_rule_versions (
 id uuid primary key default gen_random_uuid(),
 policy_set_version_id uuid not null references public.policy_set_versions(id) on delete restrict,
 rule_version_id uuid not null references public.rule_versions(id) on delete restrict,
 priority integer not null check(priority between 0 and 1000000),
 required boolean not null default true,
 configuration_json jsonb not null default '{}' check(configuration_json='{}'::jsonb),
 unique(policy_set_version_id,rule_version_id)
);
create index policy_rule_version_idx on public.policy_set_rule_versions(rule_version_id);
create table public.rule_test_cases (
 id uuid primary key default gen_random_uuid(),
 rule_version_id uuid not null references public.rule_versions(id) on delete restrict,
 name text not null check(length(name) between 1 and 120),
 input_json jsonb not null check(jsonb_typeof(input_json)='object'),
 expected_json jsonb not null check(jsonb_typeof(expected_json)='object'),
 status text not null default 'active' check(status in ('active','disabled')),
 created_at timestamptz not null default now(), unique(rule_version_id,name)
);
create table public.rule_bindings (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 rule_definition_id uuid not null,
 rule_version_id uuid not null,
 scope_type text not null check(scope_type in ('tenant','site','asset','customer')),
 scope_id uuid not null,
 priority integer not null check(priority between 0 and 1000000),
 override_mode text not null check(override_mode in ('inherit','restrict','replace')),
 valid_from timestamptz not null, valid_until timestamptz not null,
 status text not null default 'active' check(status in ('active','suspended','revoked')),
 created_by uuid not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 site_id uuid generated always as (case when scope_type='site' then scope_id end) stored,
 asset_id uuid generated always as (case when scope_type='asset' then scope_id end) stored,
 customer_id uuid generated always as (case when scope_type='customer' then scope_id end) stored,
 unique(tenant_id,id),
 foreign key(rule_definition_id,rule_version_id) references public.rule_versions(rule_definition_id,id) on delete restrict,
 foreign key(tenant_id,site_id) references public.sites(tenant_id,id) on delete restrict,
 foreign key(tenant_id,asset_id) references public.assets(tenant_id,id) on delete restrict,
 foreign key(tenant_id,customer_id) references public.customers(tenant_id,id) on delete restrict,
 check(scope_type<>'tenant' or scope_id=tenant_id),
 check(isfinite(valid_from) and isfinite(valid_until) and valid_until>valid_from)
);
create index rule_binding_version_idx on public.rule_bindings(rule_definition_id,rule_version_id);
create index rule_binding_scope_idx on public.rule_bindings(tenant_id,scope_type,scope_id,status);
create index rule_binding_site_idx on public.rule_bindings(tenant_id,site_id) where site_id is not null;
create index rule_binding_asset_idx on public.rule_bindings(tenant_id,asset_id) where asset_id is not null;
create index rule_binding_customer_idx on public.rule_bindings(tenant_id,customer_id) where customer_id is not null;
create table public.tenant_policy_readiness (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 policy_set_version_id uuid not null references public.policy_set_versions(id) on delete restrict,
 status text not null default 'pending' check(status in ('pending','ready','ready_with_warnings','blocked','superseded')),
 blocking_reasons_json jsonb not null default '["POLICY_NOT_EVALUATED"]' check(jsonb_typeof(blocking_reasons_json)='array'),
 warning_reasons_json jsonb not null default '[]' check(jsonb_typeof(warning_reasons_json)='array'),
 evaluated_at timestamptz, evaluator_version text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(tenant_id,id), unique(tenant_id,policy_set_version_id),
 check(status not in ('ready','ready_with_warnings') or (blocking_reasons_json='[]'::jsonb and evaluated_at is not null and evaluator_version is not null)),
 check(status<>'ready' or warning_reasons_json='[]'::jsonb),
 check(status<>'blocked' or blocking_reasons_json<>'[]'::jsonb)
);
create index tenant_readiness_version_idx on public.tenant_policy_readiness(policy_set_version_id);
create table public.rule_evaluations (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 policy_set_version_id uuid not null references public.policy_set_versions(id) on delete restrict,
 subject_type text not null, subject_id uuid not null, resource_type text not null, resource_id uuid not null,
 effective_at timestamptz not null check(isfinite(effective_at)),
 input_hash text not null check(input_hash ~ '^[0-9a-f]{64}$'), input_snapshot_reference text,
 decision text not null check(decision in ('allow','deny','limit','select','calculated')),
 result_json jsonb not null check(jsonb_typeof(result_json)='object'),
 reason_codes_json jsonb not null check(jsonb_typeof(reason_codes_json)='array'),
 applied_rule_versions_json jsonb not null check(jsonb_typeof(applied_rule_versions_json)='array'),
 correlation_id uuid not null,
 latency_ms numeric not null check(latency_ms>=0 and latency_ms<'Infinity'::numeric),
 evaluated_at timestamptz not null default now(), unique(tenant_id,id)
);
create index rule_evaluation_version_idx on public.rule_evaluations(policy_set_version_id);
create index rule_evaluation_tenant_time_idx on public.rule_evaluations(tenant_id,evaluated_at desc,id);
create index rule_evaluation_correlation_idx on public.rule_evaluations(tenant_id,correlation_id);

-- Protect semantic input independently of API grants. Freeze definitions from first
-- version onward; version content and approval evidence freeze when testing starts.
create function private.flexexa_guard_rule_version() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception using errcode='23514',message='RULE_VERSION_IMMUTABLE'; end if;
 if old.status in ('published','deprecated','retired') and new is distinct from old then
  raise exception using errcode='23514',message='RULE_VERSION_IMMUTABLE'; end if;
 if (to_jsonb(new)-array['status','approved_by','approved_at']) is distinct from
    (to_jsonb(old)-array['status','approved_by','approved_at']) then
  raise exception using errcode='23514',message='RULE_VERSION_IMMUTABLE'; end if;
 if not ((new.status=old.status and new is not distinct from old)
  or (old.status='draft' and new.status='testing')
  or (old.status='testing' and new.status='approved')
  or (old.status='approved' and new.status='published' and new.approved_by=old.approved_by and new.approved_at=old.approved_at)) then
  raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 return new;
end $$;
revoke all on function private.flexexa_guard_rule_version() from public,anon,authenticated;
create trigger rule_version_immutable before update or delete on public.rule_versions for each row execute function private.flexexa_guard_rule_version();
create trigger policy_version_immutable before update or delete on public.policy_set_versions for each row execute function private.flexexa_guard_rule_version();
create trigger rule_definition_immutable before update or delete on public.rule_definitions for each row execute function private.flexexa_deny_audit_mutation();
create trigger policy_set_immutable before update or delete on public.policy_sets for each row execute function private.flexexa_deny_audit_mutation();
create trigger rule_evaluation_immutable before update or delete on public.rule_evaluations for each row execute function private.flexexa_deny_audit_mutation();
create trigger tenant_id_immutable before update on public.rule_bindings for each row execute function private.flexexa_immutable_tenant_id();
create trigger tenant_id_immutable before update on public.tenant_policy_readiness for each row execute function private.flexexa_immutable_tenant_id();

create function private.flexexa_guard_rule_child() returns trigger language plpgsql set search_path='' as $$
declare parent_status text; parent uuid;
begin
 if tg_op<>'INSERT' then raise exception using errcode='23514',message='RULE_VERSION_IMMUTABLE'; end if;
 if tg_table_name='rule_test_cases' then
  parent:=new.rule_version_id;
  select status into parent_status from public.rule_versions where id=parent for update;
 else
  parent:=new.policy_set_version_id;
  select status into parent_status from public.policy_set_versions where id=parent for update;
 end if;
 if parent_status is distinct from 'draft' then raise exception using errcode='23514',message='RULE_VERSION_IMMUTABLE'; end if;
 return new;
end $$;
revoke all on function private.flexexa_guard_rule_child() from public,anon,authenticated;
create trigger rule_tests_frozen before insert or update or delete on public.rule_test_cases for each row execute function private.flexexa_guard_rule_child();
create trigger policy_members_frozen before insert or update or delete on public.policy_set_rule_versions for each row execute function private.flexexa_guard_rule_child();

create function private.flexexa_guard_rule_binding() returns trigger language plpgsql set search_path='' as $$
declare definition public.rule_definitions%rowtype; version public.rule_versions%rowtype;
begin
 if tg_op='UPDATE' and (new.id,new.tenant_id,new.rule_definition_id,new.rule_version_id,new.scope_type,new.scope_id,new.created_by,new.created_at)
  is distinct from (old.id,old.tenant_id,old.rule_definition_id,old.rule_version_id,old.scope_type,old.scope_id,old.created_by,old.created_at) then
  raise exception using errcode='23514',message='RULE_BINDING_IDENTITY_IMMUTABLE'; end if;
 select * into definition from public.rule_definitions where id=new.rule_definition_id for share;
 select * into version from public.rule_versions where id=new.rule_version_id and rule_definition_id=new.rule_definition_id for share;
 if version.status is distinct from 'published' or new.valid_from<version.valid_from or new.valid_until>version.valid_until then
  raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 if new.override_mode<>'inherit' and not definition.overridable_by_tenant then
  raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 return new;
end $$;
revoke all on function private.flexexa_guard_rule_binding() from public,anon,authenticated;
create trigger rule_binding_guard before insert or update on public.rule_bindings for each row execute function private.flexexa_guard_rule_binding();

-- No direct write grants, including service_role. Publication must use the checked
-- transaction boundary below. Tenant reads never expose another tenant's evidence.
do $$ declare t text; begin
 foreach t in array array['rule_definitions','rule_versions','policy_sets','policy_set_versions','policy_set_rule_versions','rule_test_cases','rule_bindings','tenant_policy_readiness','rule_evaluations'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
 end loop;
end $$;
create policy rule_definitions_read on public.rule_definitions for select to authenticated using(private.flexexa_is_platform_admin());
create policy rule_versions_read on public.rule_versions for select to authenticated using(private.flexexa_is_platform_admin());
create policy policy_sets_read on public.policy_sets for select to authenticated using(private.flexexa_is_platform_admin());
create policy policy_versions_read on public.policy_set_versions for select to authenticated using(private.flexexa_is_platform_admin());
create policy policy_members_read on public.policy_set_rule_versions for select to authenticated using(private.flexexa_is_platform_admin());
create policy rule_tests_read on public.rule_test_cases for select to authenticated using(private.flexexa_is_platform_admin());
create policy rule_bindings_read on public.rule_bindings for select to authenticated using(private.flexexa_has_permission(tenant_id,'rules.read'));
create policy tenant_readiness_read on public.tenant_policy_readiness for select to authenticated using(private.flexexa_has_permission(tenant_id,'rules.read'));
create policy rule_evaluations_read on public.rule_evaluations for select to authenticated using(private.flexexa_has_permission(tenant_id,'rules.read'));

-- Scope the existing canonical evidence store explicitly, as roles already do.
-- Tenant evidence still requires a real tenant; platform evidence cannot borrow one.
alter table public.idempotency_records add column scope_type text not null default 'tenant',
 alter column tenant_id drop not null,
 add constraint receipt_scope check((scope_type='tenant' and tenant_id is not null) or (scope_type='platform' and tenant_id is null and actor_type='user')),
 add constraint receipt_scope_id_unique unique(scope_type,id);
create unique index platform_receipt_key on public.idempotency_records(actor_type,actor_id,operation_key,idempotency_key) where scope_type='platform';
alter table public.audit_events add column scope_type text not null default 'tenant',
 alter column tenant_id drop not null,
 add constraint audit_scope check((scope_type='tenant' and tenant_id is not null) or (scope_type='platform' and tenant_id is null and actor_type='user')),
 add constraint audit_receipt_scope foreign key(scope_type,idempotency_record_id) references public.idempotency_records(scope_type,id) on delete restrict,
 add constraint audit_scope_receipt_unique unique(scope_type,idempotency_record_id);

create function private.flexexa_current_policy_admin() returns boolean language sql volatile security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'role','')='authenticated' and coalesce(auth.jwt()->>'aal','')='aal2'
 and coalesce(auth.jwt()->>'is_anonymous','false')='false'
 and not exists(select 1 from private.flexexa_machine_principals where auth_user_id=auth.uid())
 and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  join public.platform_memberships pm on pm.user_id=u.id
  join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
  join public.roles r on r.id=pmr.role_id
  where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id'
   and u.deleted_at is null and u.is_anonymous=false and (u.banned_until is null or u.banned_until<=clock_timestamp())
   and (s.not_after is null or s.not_after>clock_timestamp()) and pm.status='active'
   and r.scope_type='platform' and r.status='active' and r.role_key in ('platform_admin','superadmin'))
$$;
revoke all on function private.flexexa_current_policy_admin() from public,anon,authenticated;
grant execute on function private.flexexa_current_policy_admin() to authenticated;
create function private.flexexa_assert_policy_admin() returns void language plpgsql volatile security definer set search_path='' as $$
begin
 perform 1 from auth.users u join auth.sessions s on s.user_id=u.id
  join public.platform_memberships pm on pm.user_id=u.id
  join public.platform_membership_roles pmr on pmr.platform_membership_id=pm.id
  join public.roles r on r.id=pmr.role_id
  where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and r.scope_type='platform'
   and r.role_key in ('platform_admin','superadmin') for share of u,s,pm,pmr,r;
 if not private.flexexa_current_policy_admin() then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
end $$;
revoke all on function private.flexexa_assert_policy_admin() from public,anon,authenticated;
create policy platform_audit_read on public.audit_events for select to authenticated using(scope_type='platform' and private.flexexa_current_policy_admin());
alter policy rule_definitions_read on public.rule_definitions using(private.flexexa_current_policy_admin());
alter policy rule_versions_read on public.rule_versions using(private.flexexa_current_policy_admin());
alter policy policy_sets_read on public.policy_sets using(private.flexexa_current_policy_admin());
alter policy policy_versions_read on public.policy_set_versions using(private.flexexa_current_policy_admin());
alter policy policy_members_read on public.policy_set_rule_versions using(private.flexexa_current_policy_admin());
alter policy rule_tests_read on public.rule_test_cases using(private.flexexa_current_policy_admin());

create table private.flexexa_policy_test_runs (
 id uuid primary key default gen_random_uuid(),
 policy_set_version_id uuid not null references public.policy_set_versions(id) on delete restrict,
 rules_checksum text not null check(rules_checksum ~ '^[0-9a-f]{64}$'),
 stage text not null check(stage in ('automated','sandbox_shadow')),
 passed boolean not null, cases_count integer not null check(cases_count>0),
 evidence_json jsonb not null check(jsonb_typeof(evidence_json)='array'),
 actor_id uuid not null, created_at timestamptz not null default clock_timestamp()
);
create index policy_test_run_version_idx on private.flexexa_policy_test_runs(policy_set_version_id,stage,created_at desc);
create table private.flexexa_policy_targets (
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 policy_set_version_id uuid not null references public.policy_set_versions(id) on delete restrict,
 primary key(tenant_id,policy_set_version_id)
);
create index policy_target_version_idx on private.flexexa_policy_targets(policy_set_version_id,tenant_id);
create table private.flexexa_policy_publications (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 policy_set_id uuid not null, policy_set_version_id uuid not null,
 environment text not null check(environment='sandbox'),
 published_by uuid not null, published_at timestamptz not null default clock_timestamp(),
 foreign key(policy_set_id,policy_set_version_id) references public.policy_set_versions(policy_set_id,id) on delete restrict,
 foreign key(tenant_id,policy_set_version_id) references private.flexexa_policy_targets(tenant_id,policy_set_version_id) on delete restrict,
 unique(tenant_id,policy_set_version_id)
);
create index policy_publication_current_idx on private.flexexa_policy_publications(tenant_id,policy_set_id,published_at desc,id);
create index policy_publication_version_idx on private.flexexa_policy_publications(policy_set_id,policy_set_version_id);
do $$ declare t text; begin
 foreach t in array array['flexexa_policy_test_runs','flexexa_policy_targets','flexexa_policy_publications'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
  execute format('create trigger policy_evidence_immutable before update or delete on private.%I for each row execute function private.flexexa_deny_audit_mutation()',t);
 end loop;
end $$;

create function private.flexexa_policy_instant(p jsonb,k text) returns timestamptz language plpgsql immutable set search_path='' as $$
declare v text:=p->>k; result timestamptz;
begin
 if jsonb_typeof(p->k) is distinct from 'string' or v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 begin result:=v::timestamptz; exception when others then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end;
 if not isfinite(result) or to_char(result at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')<>v then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return result;
end $$;
revoke all on function private.flexexa_policy_instant(jsonb,text) from public,anon,authenticated;

create function private.flexexa_validate_power_rule(p jsonb) returns void language plpgsql immutable set search_path='' as $$
declare reason jsonb;
begin
 if jsonb_typeof(p) is distinct from 'object' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('minimum_kw','maximum_kw','deny_reasons'))
  or jsonb_typeof(p->'minimum_kw') is distinct from 'number' or jsonb_typeof(p->'maximum_kw') is distinct from 'number'
  or jsonb_typeof(p->'deny_reasons') is distinct from 'array' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 if (p->>'minimum_kw')::numeric<0 or (p->>'maximum_kw')::numeric<(p->>'minimum_kw')::numeric
  or (p->>'maximum_kw')::numeric>1000000
  or round((p->>'minimum_kw')::numeric,6)<>(p->>'minimum_kw')::numeric
  or round((p->>'maximum_kw')::numeric,6)<>(p->>'maximum_kw')::numeric
  or jsonb_array_length(p->'deny_reasons')>128 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 for reason in select value from jsonb_array_elements(p->'deny_reasons') loop
  if jsonb_typeof(reason)<>'string' or (reason#>>'{}') !~ '^[A-Z][A-Z0-9_]{0,63}$' then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 end loop;
end $$;
revoke all on function private.flexexa_validate_power_rule(jsonb) from public,anon,authenticated;

create function private.flexexa_test_power_rule(expression jsonb,requested_kw numeric) returns boolean language plpgsql immutable set search_path='' as $$
begin
 perform private.flexexa_validate_power_rule(expression);
 if requested_kw is null or requested_kw<0 or requested_kw>'1000000'::numeric or round(requested_kw,6)<>requested_kw then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return requested_kw>=(expression->>'minimum_kw')::numeric and requested_kw<=(expression->>'maximum_kw')::numeric and expression->'deny_reasons'='[]'::jsonb;
end $$;
revoke all on function private.flexexa_test_power_rule(jsonb,numeric) from public,anon,authenticated;

-- One checked transaction dispatcher under named public invoker contracts. The
-- only executable language/environment in this increment is bounded sandbox power.
create function private.flexexa_policy_workflow(action text,p jsonb,idem text,correlation uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); receipt uuid; prior public.idempotency_records%rowtype;
 h text; response jsonb; policy uuid; resource uuid; definition uuid; rule_id uuid;
 v public.policy_set_versions%rowtype; rule_item jsonb; test_item jsonb; target_item jsonb;
 start_at timestamptz; end_at timestamptz; rule_key_value text; name_value text;
 sequence_no integer; rule_no integer:=0; case_count integer:=0; all_passed boolean:=true;
 actual boolean; evidence jsonb:='[]'; row_rule record; target record; audit uuid; tenant_receipt uuid;
 min_kw numeric; max_kw numeric; denies boolean; blockers jsonb; at timestamptz;
begin
 perform private.flexexa_assert_policy_admin();
 if action is null or action not in ('create','test','shadow','approve','publish','readiness')
  or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>65536
  or idem is null or idem !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$' or idem ~ '[^A-Za-z0-9_.:-]' then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 perform private.flexexa_input_uuid(jsonb_build_object('id',correlation),'id');
 h:=encode(extensions.digest(p::text,'sha256'),'hex');
 insert into public.idempotency_records(scope_type,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
 values('platform','user',actor,'policy_'||action,idem,h,correlation)
 on conflict(actor_type,actor_id,operation_key,idempotency_key) where scope_type='platform' do nothing returning id into receipt;
 if receipt is null then
  select * into prior from public.idempotency_records where scope_type='platform' and actor_type='user' and actor_id=actor
   and operation_key='policy_'||action and idempotency_key=idem for update;
  perform private.flexexa_assert_policy_admin();
  if prior.request_hash is distinct from h then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  if prior.status is distinct from 'completed' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
  return prior.response_json;
 end if;
 if action='create' then
  if exists(select 1 from jsonb_object_keys(p) k where k not in ('policy_key','name','valid_from','valid_until','rules','tenants')) then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  rule_key_value:=private.flexexa_input_text(p,'policy_key',true,120);
  name_value:=private.flexexa_input_text(p,'name',true,120);
  if rule_key_value !~ '^[a-z][a-z0-9_.]{0,119}$' or jsonb_typeof(p->'rules') is distinct from 'array'
   or jsonb_typeof(p->'tenants') is distinct from 'array' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  if jsonb_array_length(p->'rules') not between 1 and 64 or jsonb_array_length(p->'tenants') not between 1 and 1000 then
   raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  start_at:=private.flexexa_policy_instant(p,'valid_from'); end_at:=private.flexexa_policy_instant(p,'valid_until');
  if end_at<=start_at then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  insert into public.policy_sets(policy_key,domain,name,criticality) values(rule_key_value,'power',name_value,'critical')
   on conflict(policy_key) do nothing;
  select id into policy from public.policy_sets where policy_key=rule_key_value and name=name_value and domain='power' and status='active' for update;
  if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
  select coalesce(max(version),0)+1 into sequence_no from public.policy_set_versions where policy_set_id=policy;
  insert into public.policy_set_versions(policy_set_id,version,checksum,valid_from,valid_until,created_by)
   values(policy,sequence_no,h,start_at,end_at,actor) returning * into v;
  resource:=v.id;
  for target_item in select value from jsonb_array_elements(p->'tenants') order by value::text loop
   definition:=private.flexexa_input_uuid(jsonb_build_object('id',target_item),'id');
   perform 1 from public.tenants t join public.organizations o on o.id=t.organization_id
    where t.id=definition and t.status='active' and o.status='active' for share of t,o;
   if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   insert into private.flexexa_policy_targets values(definition,resource);
  end loop;
  -- Sorted definition locks prevent opposite-order authoring deadlocks.
  for rule_item in select value from jsonb_array_elements(p->'rules') order by value->>'rule_key' loop
   if jsonb_typeof(rule_item)<>'object' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   if exists(select 1 from jsonb_object_keys(rule_item) k where k not in ('rule_key','expression','tests')) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   rule_key_value:=private.flexexa_input_text(rule_item,'rule_key',true,120);
   if rule_key_value !~ '^[a-z][a-z0-9_.]{0,119}$' or jsonb_typeof(rule_item->'tests') is distinct from 'array' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   if jsonb_array_length(rule_item->'tests') not between 1 and 32 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   perform private.flexexa_validate_power_rule(rule_item->'expression');
   insert into public.rule_definitions(rule_key,domain,name,scope_type,rule_type,input_schema_json,output_schema_json,default_effect,criticality,execution_mode)
    values(rule_key_value,'power',rule_key_value,'platform','power_limit','{"requested_kw":"number"}','{"allowed":"boolean"}','deny','critical','deterministic') on conflict(rule_key) do nothing;
   select id into definition from public.rule_definitions where rule_key=rule_key_value and domain='power' and status='active' for update;
   if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   if exists(select 1 from public.policy_set_rule_versions m join public.rule_versions r on r.id=m.rule_version_id
    where m.policy_set_version_id=resource and r.rule_definition_id=definition) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   select coalesce(max(version),0)+1 into sequence_no from public.rule_versions where rule_definition_id=definition;
   insert into public.rule_versions(rule_definition_id,version,expression_language,expression_json,checksum,valid_from,valid_until,created_by)
    values(definition,sequence_no,'flexexa.power.v1',rule_item->'expression',encode(extensions.digest(rule_item::text,'sha256'),'hex'),start_at,end_at,actor) returning id into rule_id;
   rule_no:=rule_no+1;
   insert into public.policy_set_rule_versions(policy_set_version_id,rule_version_id,priority) values(resource,rule_id,rule_no);
   for test_item in select value from jsonb_array_elements(rule_item->'tests') loop
    if jsonb_typeof(test_item)<>'object' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    if exists(select 1 from jsonb_object_keys(test_item) k where k not in ('name','requested_kw','expected_allowed'))
     or jsonb_typeof(test_item->'requested_kw') is distinct from 'number' or jsonb_typeof(test_item->'expected_allowed') is distinct from 'boolean' then
     raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    perform private.flexexa_test_power_rule(rule_item->'expression',(test_item->>'requested_kw')::numeric);
    insert into public.rule_test_cases(rule_version_id,name,input_json,expected_json)
     values(rule_id,private.flexexa_input_text(test_item,'name',true,120),jsonb_build_object('requested_kw',test_item->'requested_kw'),jsonb_build_object('allowed',test_item->'expected_allowed'));
   end loop;
  end loop;
 else
  if exists(select 1 from jsonb_object_keys(p) k where k not in ('policy_set_version_id','observations'))
   or (action<>'shadow' and p ? 'observations') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  resource:=private.flexexa_input_uuid(p,'policy_set_version_id');
  -- All transitions/publications for a policy serialize on its stable parent.
  select policy_set_id into policy from public.policy_set_versions where id=resource;
  if policy is null then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
  perform 1 from public.policy_sets where id=policy for update;
  select * into v from public.policy_set_versions where id=resource for update;
  perform private.flexexa_assert_policy_admin();
  case action
  when 'test' then
   if v.status<>'draft' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
   for row_rule in select r.id,r.expression_json,t.id test_id,t.input_json,t.expected_json
    from public.policy_set_rule_versions m join public.rule_versions r on r.id=m.rule_version_id
    join public.rule_test_cases t on t.rule_version_id=r.id and t.status='active' where m.policy_set_version_id=resource order by r.id,t.id loop
    actual:=private.flexexa_test_power_rule(row_rule.expression_json,(row_rule.input_json->>'requested_kw')::numeric);
    all_passed:=all_passed and actual=(row_rule.expected_json->>'allowed')::boolean; case_count:=case_count+1;
    evidence:=evidence||jsonb_build_array(jsonb_build_object('test_id',row_rule.test_id,'allowed',actual,'expected',row_rule.expected_json->'allowed'));
   end loop;
   if case_count=0 then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   insert into private.flexexa_policy_test_runs(policy_set_version_id,rules_checksum,stage,passed,cases_count,evidence_json,actor_id)
    values(resource,v.checksum,'automated',all_passed,case_count,evidence,actor);
   if all_passed then
    update public.rule_versions set status='testing' where id in(select rule_version_id from public.policy_set_rule_versions where policy_set_version_id=resource);
    update public.policy_set_versions set status='testing' where id=resource;
   end if;
  when 'shadow' then
   if v.status<>'testing' then raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
   if jsonb_typeof(p->'observations') is distinct from 'array' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   if jsonb_array_length(p->'observations') not between 1 and 256 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   for test_item in select value from jsonb_array_elements(p->'observations') loop
    if jsonb_typeof(test_item)<>'object' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    if exists(select 1 from jsonb_object_keys(test_item) k where k not in ('requested_kw','expected_allowed'))
     or jsonb_typeof(test_item->'requested_kw') is distinct from 'number' or jsonb_typeof(test_item->'expected_allowed') is distinct from 'boolean' then
     raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
    actual:=true;
    for row_rule in select r.expression_json from public.rule_versions r join public.policy_set_rule_versions m on m.rule_version_id=r.id where m.policy_set_version_id=resource loop
     actual:=private.flexexa_test_power_rule(row_rule.expression_json,(test_item->>'requested_kw')::numeric) and actual;
    end loop;
    all_passed:=all_passed and actual=(test_item->>'expected_allowed')::boolean; case_count:=case_count+1;
    evidence:=evidence||jsonb_build_array(test_item||jsonb_build_object('allowed',actual));
   end loop;
   insert into private.flexexa_policy_test_runs(policy_set_version_id,rules_checksum,stage,passed,cases_count,evidence_json,actor_id)
    values(resource,v.checksum,'sandbox_shadow',all_passed,case_count,evidence,actor);
  when 'approve' then
   if v.status<>'testing' or v.created_by=actor then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   if (select passed from private.flexexa_policy_test_runs where policy_set_version_id=resource and rules_checksum=v.checksum and stage='automated' order by created_at desc,id desc limit 1) is distinct from true
    or (select passed from private.flexexa_policy_test_runs where policy_set_version_id=resource and rules_checksum=v.checksum and stage='sandbox_shadow' order by created_at desc,id desc limit 1) is distinct from true then
    raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   update public.rule_versions set status='approved',approved_by=actor,approved_at=clock_timestamp()
    where id in(select rule_version_id from public.policy_set_rule_versions where policy_set_version_id=resource);
   update public.policy_set_versions set status='approved',approved_by=actor,approved_at=clock_timestamp() where id=resource;
  when 'publish' then
   at:=clock_timestamp();
   if v.status<>'approved' or v.valid_from>at or v.valid_until<=at or exists(select 1 from public.policy_set_versions where policy_set_id=policy and version>v.version and status='published') then
    raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   for target in select t.id,t.organization_id from private.flexexa_policy_targets x join public.tenants t on t.id=x.tenant_id where x.policy_set_version_id=resource order by t.id loop
    perform 1 from public.tenants t join public.organizations o on o.id=t.organization_id where t.id=target.id and t.status='active' and o.status='active' for share of t,o;
    if not found then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
    insert into private.flexexa_policy_publications(tenant_id,policy_set_id,policy_set_version_id,environment,published_by) values(target.id,policy,resource,'sandbox',actor);
    update public.tenant_policy_readiness set status='superseded',updated_at=clock_timestamp() where tenant_id=target.id
     and policy_set_version_id in(select id from public.policy_set_versions where policy_set_id=policy) and status<>'superseded';
    insert into public.tenant_policy_readiness(tenant_id,policy_set_version_id) values(target.id,resource);
    insert into public.idempotency_records(tenant_id,actor_type,actor_id,operation_key,idempotency_key,request_hash,correlation_id)
     values(target.id,'user',actor,'policy_publication',resource::text,v.checksum,correlation) returning id into tenant_receipt;
    insert into public.audit_events(tenant_id,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
     values(target.id,'user',actor,'policy_publish','policy_set_version',resource,correlation,tenant_receipt,jsonb_build_object('environment','sandbox','checksum',v.checksum)) returning id into audit;
    insert into public.outbox_events(tenant_id,organization_id,audit_event_id,event_type,correlation_id,source,payload_json)
     values(target.id,target.organization_id,audit,'flexexa.policy.published',correlation,'flexexa.policy',jsonb_build_object('environment','sandbox','policy_set_version_id',resource,'rules_checksum',v.checksum));
    update public.idempotency_records set status='completed',response_reference=resource,response_json=jsonb_build_object('policy_set_version_id',resource,'environment','sandbox') where id=tenant_receipt;
   end loop;
   update public.rule_versions set status='published' where id in(select rule_version_id from public.policy_set_rule_versions where policy_set_version_id=resource);
   update public.policy_set_versions set status='published' where id=resource;
  when 'readiness' then
   if v.status<>'published' or not exists(select 1 from private.flexexa_policy_publications x where x.policy_set_version_id=resource
    and not exists(select 1 from private.flexexa_policy_publications newer join public.policy_set_versions nv on nv.id=newer.policy_set_version_id
     where newer.tenant_id=x.tenant_id and newer.policy_set_id=policy and nv.version>v.version)) then
    raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
   select max((r.expression_json->>'minimum_kw')::numeric),min((r.expression_json->>'maximum_kw')::numeric),bool_or(r.expression_json->'deny_reasons'<>'[]'::jsonb)
    into min_kw,max_kw,denies from public.rule_versions r join public.policy_set_rule_versions m on m.rule_version_id=r.id where m.policy_set_version_id=resource;
   for target in select t.id,t.status,o.status organization_status from private.flexexa_policy_publications x join public.tenants t on t.id=x.tenant_id join public.organizations o on o.id=t.organization_id
    where x.policy_set_version_id=resource and not exists(select 1 from private.flexexa_policy_publications newer
     join public.policy_set_versions nv on nv.id=newer.policy_set_version_id where newer.tenant_id=t.id and newer.policy_set_id=policy and nv.version>v.version)
    order by t.id for share of t,o loop
    -- Sandbox evidence is never production readiness or control authorization.
    blockers:='["SANDBOX_ONLY"]';
    if min_kw>max_kw or denies then blockers:=blockers||'"POLICY_DENIED"'::jsonb; end if;
    if v.valid_from>clock_timestamp() or v.valid_until<=clock_timestamp() then blockers:=blockers||'"POLICY_EXPIRED"'::jsonb; end if;
    if target.status<>'active' or target.organization_status<>'active' then blockers:=blockers||'"TENANT_INACTIVE"'::jsonb; end if;
    update public.tenant_policy_readiness set status='blocked',blocking_reasons_json=blockers,warning_reasons_json='[]',evaluated_at=clock_timestamp(),evaluator_version='flexexa.power.v1.sandbox',updated_at=clock_timestamp()
     where tenant_id=target.id and policy_set_version_id=resource;
   end loop;
  end case;
 end if;
 perform private.flexexa_assert_policy_admin();
 if action='publish' and v.valid_until<=clock_timestamp() then raise exception using errcode='P0001',message='POLICY_DENIED'; end if;
 response:=jsonb_build_object('policy_set_version_id',resource,'status',(select status from public.policy_set_versions where id=resource),'environment','sandbox','correlation_id',correlation);
 if action in ('test','shadow') then response:=response||jsonb_build_object('passed',all_passed,'cases_count',case_count); end if;
 insert into public.audit_events(scope_type,actor_type,actor_id,action,resource_type,resource_id,correlation_id,idempotency_record_id,metadata_json)
  values('platform','user',actor,'policy_'||action,'policy_set_version',resource,correlation,receipt,jsonb_build_object('environment','sandbox','request_hash',h));
 update public.idempotency_records set status='completed',response_reference=resource,response_json=response where id=receipt;
 return response;
exception when unique_violation or foreign_key_violation or check_violation or numeric_value_out_of_range then
 raise exception using errcode='P0001',message='VALIDATION_ERROR';
end $$;
revoke all on function private.flexexa_policy_workflow(text,jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function private.flexexa_policy_workflow(text,jsonb,text,uuid) to authenticated;
create function public.flexexa_create_policy_set_version(p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_policy_workflow('create',p_payload,p_idempotency_key,p_correlation_id)$$;
create function public.flexexa_test_policy_set_version(p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_policy_workflow('test',p_payload,p_idempotency_key,p_correlation_id)$$;
create function public.flexexa_shadow_policy_set_version(p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_policy_workflow('shadow',p_payload,p_idempotency_key,p_correlation_id)$$;
create function public.flexexa_approve_policy_set_version(p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_policy_workflow('approve',p_payload,p_idempotency_key,p_correlation_id)$$;
create function public.flexexa_publish_policy_set_version(p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_policy_workflow('publish',p_payload,p_idempotency_key,p_correlation_id)$$;
create function public.flexexa_evaluate_tenant_policy_readiness(p_payload jsonb,p_idempotency_key text,p_correlation_id uuid)
returns jsonb language sql volatile security invoker set search_path='' as $$select private.flexexa_policy_workflow('readiness',p_payload,p_idempotency_key,p_correlation_id)$$;
do $$ declare n text; begin
 foreach n in array array['create','test','shadow','approve','publish'] loop
  execute format('revoke all on function public.flexexa_%s_policy_set_version(jsonb,text,uuid) from public,anon,authenticated,service_role',n);
  execute format('grant execute on function public.flexexa_%s_policy_set_version(jsonb,text,uuid) to authenticated',n);
 end loop;
end $$;
revoke all on function public.flexexa_evaluate_tenant_policy_readiness(jsonb,text,uuid) from public,anon,authenticated,service_role;
grant execute on function public.flexexa_evaluate_tenant_policy_readiness(jsonb,text,uuid) to authenticated;
-- The legacy tenant policy must not become an alternate platform-audit path.
alter policy audit_events_authorized_read on public.audit_events using(scope_type='tenant' and private.flexexa_has_permission(tenant_id,'audit.read'));
create function private.flexexa_policy_reader(t uuid) returns boolean language sql volatile security definer set search_path='' as $$
 select coalesce(auth.jwt()->>'role','')='authenticated' and coalesce(auth.jwt()->>'is_anonymous','false')='false'
 and exists(select 1 from auth.users u join auth.sessions s on s.user_id=u.id
  where u.id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and u.deleted_at is null and u.is_anonymous=false
   and (u.banned_until is null or u.banned_until<=clock_timestamp()) and (s.not_after is null or s.not_after>clock_timestamp()))
 and (private.flexexa_current_policy_admin() or private.flexexa_has_permission(t,'rules.read'))
$$;
revoke all on function private.flexexa_policy_reader(uuid) from public,anon,authenticated,service_role;
grant execute on function private.flexexa_policy_reader(uuid) to authenticated;
alter policy rule_bindings_read on public.rule_bindings using(private.flexexa_policy_reader(tenant_id));
alter policy tenant_readiness_read on public.tenant_policy_readiness using(private.flexexa_policy_reader(tenant_id));
alter policy rule_evaluations_read on public.rule_evaluations using(private.flexexa_policy_reader(tenant_id));
