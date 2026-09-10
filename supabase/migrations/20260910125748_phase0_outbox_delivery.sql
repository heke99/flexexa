-- Environment-bound delivery of existing transactional events. Unclassified events
-- remain pending; their environment is never guessed from the worker or tenant.
insert into public.permissions(permission_key,description,domain,action,scope_type,risk_level)
 values('events.publish','Deliver tenant events with an explicit matching environment','events','publish','tenant','high');

create table private.flexexa_outbox_leases (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 event_id uuid not null,
 generation integer not null check(generation between 1 and 10),
 principal_id uuid not null references private.flexexa_machine_principals(id) on delete restrict,
 session_id uuid not null,
 environment text not null check(environment in ('sandbox','production')),
 created_at timestamptz not null,
 expires_at timestamptz not null,
 unique(tenant_id,id), unique(tenant_id,event_id,generation),
 foreign key(tenant_id,event_id) references public.outbox_events(tenant_id,id) on delete restrict,
 check(isfinite(created_at) and isfinite(expires_at) and expires_at>created_at and expires_at<=created_at+interval '30 seconds')
);
create index outbox_lease_principal_idx on private.flexexa_outbox_leases(principal_id);
create table private.flexexa_outbox_delivery_results (
 lease_id uuid primary key,
 tenant_id uuid not null references public.tenants(id) on delete restrict,
 requested_outcome text not null check(requested_outcome in ('published','retry')),
 status text not null check(status in ('published','pending','dead_letter')),
 completed_at timestamptz not null default clock_timestamp(),
 foreign key(tenant_id,lease_id) references private.flexexa_outbox_leases(tenant_id,id) on delete restrict,
 check((requested_outcome='published')=(status='published'))
);
create index outbox_delivery_results_tenant_idx on private.flexexa_outbox_delivery_results(tenant_id,lease_id);
alter table private.flexexa_outbox_leases enable row level security;
alter table private.flexexa_outbox_delivery_results enable row level security;
revoke all on private.flexexa_outbox_leases,private.flexexa_outbox_delivery_results from public,anon,authenticated;
create trigger outbox_lease_immutable before update or delete on private.flexexa_outbox_leases
 for each row execute function private.flexexa_deny_audit_mutation();
create trigger outbox_result_immutable before update or delete on private.flexexa_outbox_delivery_results
 for each row execute function private.flexexa_deny_audit_mutation();
create index outbox_environment_pending_idx on public.outbox_events(tenant_id,(payload_json->>'environment'),available_at,id)
 where status='pending';

-- Separate from general machine preflight: locks current canonical authority and
-- checks wall-clock expiry after lock waits. API clients/humans cannot publish.
create function private.flexexa_assert_outbox_publisher(p_tenant_id uuid,p_environment text)
returns uuid language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); claims jsonb:=auth.jwt(); session uuid; at timestamptz;
 u auth.users%rowtype; s auth.sessions%rowtype; b private.flexexa_machine_principals%rowtype;
 t public.tenants%rowtype; o public.organizations%rowtype; service public.service_identities%rowtype;
 permission public.permissions%rowtype; g public.service_identity_tenant_grants%rowtype;
begin
 if actor is null or claims->>'role' is distinct from 'authenticated'
  or coalesce(claims->>'is_anonymous','false')<>'false'
  or p_environment is null or p_environment not in ('sandbox','production') then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 begin session:=private.flexexa_input_uuid(claims,'session_id');
 exception when others then raise exception using errcode='42501',message='PERMISSION_DENIED'; end;
 select * into u from auth.users where id=actor for share;
 select * into s from auth.sessions where id=session and user_id=actor for share;
 select * into b from private.flexexa_machine_principals where auth_user_id=actor for share;
 select * into t from public.tenants where id=p_tenant_id for share;
 select * into o from public.organizations where id=t.organization_id for share;
 select * into service from public.service_identities where id=b.service_identity_id for share;
 select * into permission from public.permissions where permission_key='events.publish' for share;
 select * into g from public.service_identity_tenant_grants where service_identity_id=service.id
  and tenant_id=p_tenant_id and permission_id=permission.id for share;
 at:=clock_timestamp();
 if u.id is null or u.deleted_at is not null or u.is_anonymous is distinct from false
  or (u.banned_until is not null and u.banned_until>at) or s.id is null or (s.not_after is not null and s.not_after<=at)
  or b.id is null or b.principal_type<>'service' or b.status<>'active' or b.environment<>p_environment
  or b.valid_from>at or (b.valid_until is not null and b.valid_until<=at)
  or t.status is distinct from 'active' or o.status is distinct from 'active' or service.status is distinct from 'active'
  or permission.status is distinct from 'active' or permission.scope_type is distinct from 'tenant'
  or permission.requires_mfa or permission.requires_step_up
  or g.id is null or g.scope_json is distinct from jsonb_build_object('environment',p_environment)
  or g.valid_from>at or (g.valid_until is not null and g.valid_until<=at)
  or exists(select 1 from public.memberships where user_id=actor)
  or exists(select 1 from public.platform_memberships where user_id=actor) then
  raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 return b.id;
end $$;
revoke all on function private.flexexa_assert_outbox_publisher(uuid,text) from public,anon,authenticated;

create function private.flexexa_claim_outbox_event(p_tenant_id uuid,p_environment text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare principal uuid; event public.outbox_events%rowtype; lease private.flexexa_outbox_leases%rowtype; at timestamptz;
begin
 principal:=private.flexexa_assert_outbox_publisher(p_tenant_id,p_environment);
 select * into event from public.outbox_events e where e.tenant_id=p_tenant_id and e.status='pending'
  and e.payload_json->>'environment'=p_environment and e.available_at<=clock_timestamp()
  order by e.available_at,e.id limit 1 for update skip locked;
 if not found then return null; end if;
 perform private.flexexa_assert_outbox_publisher(p_tenant_id,p_environment);
 at:=clock_timestamp();
 -- A crashed final attempt must not leave an infinitely claimable event.
 if event.attempt_count>=10 then
  update public.outbox_events set status='dead_letter' where tenant_id=p_tenant_id and id=event.id;
  return null;
 end if;
 insert into private.flexexa_outbox_leases(tenant_id,event_id,generation,principal_id,session_id,environment,created_at,expires_at)
  values(p_tenant_id,event.id,event.attempt_count+1,principal,(auth.jwt()->>'session_id')::uuid,p_environment,at,at+interval '30 seconds') returning * into lease;
 update public.outbox_events set attempt_count=lease.generation,available_at=lease.expires_at where tenant_id=p_tenant_id and id=event.id;
 return jsonb_build_object('lease_id',lease.id,'generation',lease.generation,'expires_at',lease.expires_at,'environment',p_environment,
  'event',jsonb_build_object('event_id',event.id,'tenant_id',event.tenant_id,'organization_id',event.organization_id,
   'event_type',event.event_type,'event_version',event.event_version,'occurred_at',event.occurred_at,'received_at',event.received_at,
   'correlation_id',event.correlation_id,'causation_id',event.causation_id,'source',event.source,'payload',event.payload_json));
end $$;
revoke all on function private.flexexa_claim_outbox_event(uuid,text) from public,anon,authenticated;
grant execute on function private.flexexa_claim_outbox_event(uuid,text) to authenticated;
create function public.flexexa_claim_outbox_event(p_tenant_id uuid,p_environment text)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_claim_outbox_event(p_tenant_id,p_environment)
$$;
revoke all on function public.flexexa_claim_outbox_event(uuid,text) from public,anon,authenticated;
grant execute on function public.flexexa_claim_outbox_event(uuid,text) to authenticated;

create function private.flexexa_finish_outbox_event(p_tenant_id uuid,p_environment text,p_lease_id uuid,p_outcome text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare principal uuid; event public.outbox_events%rowtype; lease private.flexexa_outbox_leases%rowtype;
 result private.flexexa_outbox_delivery_results%rowtype; at timestamptz; outcome_status text;
begin
 principal:=private.flexexa_assert_outbox_publisher(p_tenant_id,p_environment);
 if p_outcome is null or p_outcome not in ('published','retry') or p_lease_id is null then
  raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 select * into lease from private.flexexa_outbox_leases where tenant_id=p_tenant_id and id=p_lease_id
  and principal_id=principal and session_id=(auth.jwt()->>'session_id')::uuid and environment=p_environment;
 if not found then raise exception using errcode='42501',message='PERMISSION_DENIED'; end if;
 select * into event from public.outbox_events where tenant_id=p_tenant_id and id=lease.event_id for update;
 perform private.flexexa_assert_outbox_publisher(p_tenant_id,p_environment);
 at:=clock_timestamp();
 select * into result from private.flexexa_outbox_delivery_results where tenant_id=p_tenant_id and lease_id=p_lease_id;
 if found then
  if result.requested_outcome<>p_outcome then raise exception using errcode='P0001',message='IDEMPOTENCY_CONFLICT'; end if;
  return jsonb_build_object('lease_id',p_lease_id,'status',result.status);
 end if;
 if event.status<>'pending' or event.attempt_count<>lease.generation or lease.expires_at<=at then
  raise exception using errcode='P0001',message='INVALID_STATE_TRANSITION'; end if;
 outcome_status:=case when p_outcome='published' then 'published' when lease.generation>=10 then 'dead_letter' else 'pending' end;
 update public.outbox_events set status=outcome_status,published_at=case when outcome_status='published' then at else null end,
  available_at=case when outcome_status='pending' then at+make_interval(secs=>least(300,power(2,lease.generation)::integer)) else available_at end
  where tenant_id=p_tenant_id and id=event.id;
 insert into private.flexexa_outbox_delivery_results(tenant_id,lease_id,requested_outcome,status,completed_at)
  values(p_tenant_id,p_lease_id,p_outcome,outcome_status,at);
 return jsonb_build_object('lease_id',p_lease_id,'status',outcome_status);
end $$;
revoke all on function private.flexexa_finish_outbox_event(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function private.flexexa_finish_outbox_event(uuid,text,uuid,text) to authenticated;
create function public.flexexa_finish_outbox_event(p_tenant_id uuid,p_environment text,p_lease_id uuid,p_outcome text)
returns jsonb language sql volatile security invoker set search_path='' as $$
 select private.flexexa_finish_outbox_event(p_tenant_id,p_environment,p_lease_id,p_outcome)
$$;
revoke all on function public.flexexa_finish_outbox_event(uuid,text,uuid,text) from public,anon,authenticated;
grant execute on function public.flexexa_finish_outbox_event(uuid,text,uuid,text) to authenticated;
