-- Platform-owned acquisition register, not tenant/customer data. No anonymous table access.
create schema if not exists flexexa_acquisition;
revoke all on schema flexexa_acquisition from public,anon,authenticated;
create table flexexa_acquisition.settings(singleton boolean primary key default true check(singleton), base_count integer not null default 93 check(base_count=93),new_count integer not null default 0 check(new_count>=0), secret_hash text, owner_email text not null default 'hekmat.h@div3rsa.com');
insert into flexexa_acquisition.settings(singleton) values(true);
create table flexexa_acquisition.applications(
 id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(btrim(email)) and length(email)<=254),
 first_name text not null check(length(first_name) between 1 and 100),last_name text not null check(length(last_name) between 1 and 100),
 annual_miles integer not null check(annual_miles between 0 and 100000),car text not null check(length(car) between 2 and 180),
 position integer unique, offer_group text not null check(offer_group in ('first_1000','following','test')),
 marketing_consent boolean not null default false,privacy_version text not null check(privacy_version='applications-2026-11-02-v1'),
 created_at timestamptz not null default now(),is_test boolean not null default false,
 check((is_test and position is null and offer_group='test') or (not is_test and position>93 and offer_group=case when position<=1000 then 'first_1000' else 'following' end))
);
create table flexexa_acquisition.email_jobs(
 id uuid primary key default gen_random_uuid(),application_id uuid not null unique references flexexa_acquisition.applications(id),
 payload jsonb not null,state text not null default 'pending' check(state in ('pending','processing','sent','failed','review')),
 attempts integer not null default 0,first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(),lease_until timestamptz,claim_token uuid,
 provider_id text,last_error text,updated_at timestamptz not null default now()
);
create index email_jobs_ready on flexexa_acquisition.email_jobs(next_attempt_at) where state in ('pending','processing');
create table flexexa_acquisition.rate_limits(bucket text not null,window_start timestamptz not null,requests integer not null,primary key(bucket,window_start));
create table flexexa_acquisition.events(id bigint generated always as identity primary key,action text not null,object_id uuid,actor_id uuid,occurred_at timestamptz not null default now());
alter table flexexa_acquisition.settings enable row level security;
alter table flexexa_acquisition.applications enable row level security;
alter table flexexa_acquisition.email_jobs enable row level security;
alter table flexexa_acquisition.rate_limits enable row level security;
alter table flexexa_acquisition.events enable row level security;
revoke all on all tables in schema flexexa_acquisition from public,anon,authenticated;
-- One narrowly scoped server RPC. Secret is stored only as a digest; no service-role key in web.
create function public.flexexa_applications(p_action text,p_secret text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s flexexa_acquisition.settings%rowtype;a flexexa_acquisition.applications%rowtype;
 j flexexa_acquisition.email_jobs%rowtype; n integer;v_test boolean;v_email text;v_member uuid;v_role uuid;v_bucket text;v_hour timestamptz;v_rows integer;v_group text;
begin
 select * into s from flexexa_acquisition.settings where singleton;
 if s.secret_hash is null or encode(sha256(convert_to(coalesce(p_secret,''),'UTF8')),'hex')<>s.secret_hash then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
 if p_action='stats' then return jsonb_build_object('count',93+s.new_count,'remaining',greatest(0,907-s.new_count));end if;
 if p_action='owner_login' then
  if auth.uid() is null or not exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)=s.owner_email and u.email_confirmed_at is not null) then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
  select id into v_member from public.platform_memberships where user_id=auth.uid();
  if v_member is null then
   insert into public.platform_memberships(user_id,status) values(auth.uid(),'active') returning id into v_member;
   select id into v_role from public.roles where role_key='superadmin' and scope_type='platform' and status='active';
   if v_role is null then raise exception 'ROLE_NOT_READY';end if;
   insert into public.platform_membership_roles(platform_membership_id,role_id) values(v_member,v_role);
   insert into flexexa_acquisition.events(action,actor_id) values('owner.bootstrap',auth.uid());
  end if;
  return jsonb_build_object('ok',true);
 end if;
 if p_action='admin_list' then
  if auth.uid() is null or not exists(select 1 from public.platform_memberships m join public.platform_membership_roles mr on mr.platform_membership_id=m.id join public.roles r on r.id=mr.role_id where m.user_id=auth.uid() and m.status='active' and r.status='active' and r.scope_type='platform' and r.role_key='superadmin') then raise exception 'ACCESS_DENIED' using errcode='42501';end if;
  insert into flexexa_acquisition.events(action,actor_id) values('applications.read',auth.uid());
  return jsonb_build_object('count',93+s.new_count,'base',93,'new',s.new_count,'applications',coalesce((select jsonb_agg(to_jsonb(q)) from (select a.*,j.state as email_state,j.provider_id,j.last_error,j.attempts from flexexa_acquisition.applications a left join flexexa_acquisition.email_jobs j on j.application_id=a.id order by a.created_at desc limit 100 offset greatest(0,least(100000,(p_data->>'page')::integer))*100) q),'[]'::jsonb));
 end if;
 if p_action='submit' then
  v_test=coalesce((p_data->>'is_test')::boolean,false);v_email=lower(btrim(p_data->>'email'));
  if v_email is null or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>254 or p_data->>'privacy_version'<>'applications-2026-11-02-v1' then raise exception 'INVALID_APPLICATION';end if;
  if v_test and v_email<>'delivered@resend.dev' then raise exception 'INVALID_TEST';end if;
  -- Budgets are persistent and checked under locks. Only hashes of network origin are retained.
  v_hour=date_trunc('hour',now());
  foreach v_bucket in array array['global',coalesce(p_data->>'network_hash','unknown')] loop
   insert into flexexa_acquisition.rate_limits values(v_bucket,v_hour,1) on conflict(bucket,window_start) do update set requests=flexexa_acquisition.rate_limits.requests+1 returning requests into n;
   if n>(case when v_bucket='global' then 300 else 15 end) then return jsonb_build_object('limited',true);end if;
  end loop;
  perform pg_advisory_xact_lock(hashtextextended(v_email,721));
  if exists(select 1 from flexexa_acquisition.applications where email=v_email) then return jsonb_build_object('ok',true,'created',false);end if;
  if v_test then n=null;v_group='test';else
   update flexexa_acquisition.settings set new_count=new_count+1 where singleton returning 93+new_count into n;
   v_group=case when n<=1000 then 'first_1000' else 'following' end;
  end if;
  insert into flexexa_acquisition.applications(email,first_name,last_name,annual_miles,car,position,offer_group,marketing_consent,privacy_version,is_test)
  values(v_email,btrim(p_data->>'first_name'),btrim(p_data->>'last_name'),(p_data->>'annual_miles')::integer,btrim(p_data->>'car'),n,v_group,coalesce((p_data->>'marketing_consent')::boolean,false),'applications-2026-11-02-v1',v_test) returning * into a;
  insert into flexexa_acquisition.email_jobs(application_id,payload) values(a.id,jsonb_build_object(
   'from','Flexexa via Trafexa Nordic <info@trafexa.com>','reply_to','info@flexexa.com','to',jsonb_build_array(a.email),
   'subject',case when v_test then '[Tekniskt test] ' else '' end||'Tack för din ansökan till Flexexa',
   'text','Hej '||a.first_name||E'!\n\nTack för din ansökan till Flexexas elbilsabonnemang. '||case when v_test then 'Detta är en teknisk testansökan.' when n<=1000 then 'Din ansökan hör till de första 1 000 och gruppen för specialerbjudandet.' else 'De första 1 000 platserna är tilldelade. Din ansökan hör till gruppen för nästa erbjudande.' end||E'\n\nAnsökan är inte bindande och innebär inget köp eller någon betalningsskyldighet. Vi kontaktar dig om din ansökan. Exakta priser, täckning och villkor lämnas före ett eventuellt avtal.\n\nDina uppgifter säljs inte. Läs hur vi använder dem: https://www.flexexa.com/elbilsabonnemang/integritet\n\nFrågor, rättelse, radering eller återkallelse av marknadsföringssamtycke: svara på detta mejl eller kontakta info@flexexa.com.\n\nVänliga hälsningar\nFlexexa / Trafexa Nordic AB'));
  insert into flexexa_acquisition.events(action,object_id) values('application.created',a.id);
  return jsonb_build_object('ok',true,'created',true);
 end if;
 if p_action='claim_email' then
  -- Never retry an uncertain send after the provider's 24-hour idempotency window.
  update flexexa_acquisition.email_jobs set state='review',last_error='RECONCILIATION_REQUIRED' where state in ('pending','processing') and first_attempt_at<now()-interval '23 hours';
  select * into j from flexexa_acquisition.email_jobs where (state='pending' and next_attempt_at<=now() or state='processing' and lease_until<now()) and attempts<6 order by next_attempt_at for update skip locked limit 1;
  if not found then return 'null'::jsonb;end if;
  update flexexa_acquisition.email_jobs set state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_until=now()+interval '2 minutes',claim_token=gen_random_uuid(),updated_at=now() where id=j.id returning * into j;
  return jsonb_build_object('id',j.id,'claim_token',j.claim_token,'payload',j.payload);
 end if;
 if p_action='finish_email' then
  update flexexa_acquisition.email_jobs set state=case when p_data->>'outcome'='sent' then 'sent' when p_data->>'outcome'='permanent' then 'failed' when attempts>=6 then 'review' else 'pending' end,
   provider_id=case when p_data->>'outcome'='sent' then p_data->>'provider_id' else provider_id end,
   last_error=left(p_data->>'error',100),next_attempt_at=now()+interval '5 minutes',lease_until=null,updated_at=now()
   where id=(p_data->>'id')::uuid and claim_token=(p_data->>'claim_token')::uuid and state='processing';
  get diagnostics v_rows=row_count;return jsonb_build_object('updated',v_rows);
 end if;
 raise exception 'UNKNOWN_OPERATION';
end; $$;
revoke all on function public.flexexa_applications(text,text,jsonb) from public;
grant execute on function public.flexexa_applications(text,text,jsonb) to anon,authenticated;
comment on function public.flexexa_applications(text,text,jsonb) is 'Scoped server acquisition API; all operations require server capability; administration also requires live verified canonical platform superadmin membership. No table access is granted.';
