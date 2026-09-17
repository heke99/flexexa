-- Generated from immutable country-packs/se/v1.json; source SHA256 a9a4216520e94f505eadaa2099e46f4bc8ea22ef8402ef6486526525a7b5347d.
-- Preserve V1 normalized requests, hashes, historical receipts and existing rows.
create function private.flexexa_core_v1_country_defaults()
returns jsonb language sql immutable set search_path='' as $$
 select '{"country_code":"SE","timezone":"Europe/Stockholm","currency":"SEK","locale":"sv-SE"}'::jsonb
$$;
revoke all on function private.flexexa_core_v1_country_defaults() from public,anon,authenticated;
grant execute on function private.flexexa_core_v1_country_defaults() to authenticated,service_role;
comment on function private.flexexa_core_v1_country_defaults() is 'Immutable core V1 country defaults compiled from country pack version 1.0.0. Metadata is not tax, market or control readiness.';

create or replace function private.flexexa_normalize_core_input(kind text,p jsonb)
returns jsonb language plpgsql stable set search_path='' as $$
declare allowed text[]; n jsonb; v text; resolution numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>16384 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 case kind
 when 'customer' then
  allowed:=array['customer_type','display_name','external_customer_id'];
  if jsonb_typeof(p->'customer_type') is distinct from 'string' or p->>'customer_type' not in ('person','company') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('customer_type',p->>'customer_type','display_name',private.flexexa_input_text(p,'display_name',true),
     'external_customer_id',private.flexexa_input_text(p,'external_customer_id'));
 when 'site' then
  allowed:=array['customer_id','name','external_site_id','country_code','timezone'];
  v:=case when p?'country_code' then p->>'country_code' else private.flexexa_core_v1_country_defaults()->>'country_code' end;
  if v is null or length(v)<>2 or v !~ '^[A-Z]{2}$' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('customer_id',private.flexexa_input_uuid(p,'customer_id'),'name',private.flexexa_input_text(p,'name',true),
    'external_site_id',private.flexexa_input_text(p,'external_site_id'),'country_code',v,
    'timezone',case when p?'timezone' then private.flexexa_input_text(p,'timezone',true,100) else private.flexexa_core_v1_country_defaults()->>'timezone' end);
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=n->>'timezone') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 when 'metering_point' then
  allowed:=array['site_id','external_metering_point_id','metering_point_type','measurement_resolution_minutes','market_area_id'];
  v:=case when p?'metering_point_type' then p->>'metering_point_type' else 'consumption' end;
  if v is null or v not in ('consumption','production','bidirectional') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  if p?'measurement_resolution_minutes' then
   if jsonb_typeof(p->'measurement_resolution_minutes') is distinct from 'number' then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
   resolution:=(p->>'measurement_resolution_minutes')::numeric;
   if resolution<>trunc(resolution) or resolution<1 or resolution>1440 then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  else resolution:=15; end if;
  n:=jsonb_build_object('site_id',private.flexexa_input_uuid(p,'site_id'),
    'external_metering_point_id',private.flexexa_input_text(p,'external_metering_point_id',true),
    'metering_point_type',v,'measurement_resolution_minutes',resolution::integer,
    'market_area_id',private.flexexa_input_uuid(p,'market_area_id',false));
 when 'asset' then
  allowed:=array['customer_id','site_id','asset_type','display_name','external_id','manufacturer','model','rated_power_kw','energy_capacity_kwh'];
  v:=p->>'asset_type';
  if jsonb_typeof(p->'asset_type') is distinct from 'string' or v not in ('ev','evse','battery','solar_inverter','meter','heat_pump','hems','hvac','industrial_load','generator','other_der','other_flexible_load') then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
  n:=jsonb_build_object('customer_id',private.flexexa_input_uuid(p,'customer_id'),'site_id',private.flexexa_input_uuid(p,'site_id'),
    'asset_type',v,'display_name',private.flexexa_input_text(p,'display_name',true),'external_id',private.flexexa_input_text(p,'external_id'),
    'manufacturer',private.flexexa_input_text(p,'manufacturer'),'model',private.flexexa_input_text(p,'model'),
    'rated_power_kw',private.flexexa_input_power(p,'rated_power_kw',9),'energy_capacity_kwh',private.flexexa_input_power(p,'energy_capacity_kwh',11));
 else raise exception using errcode='P0001',message='VALIDATION_ERROR';
 end case;
 if exists(select 1 from jsonb_object_keys(p) k where not k=any(allowed)) then raise exception using errcode='P0001',message='VALIDATION_ERROR'; end if;
 return n;
end $$;

alter table public.organizations alter column country_code set default (private.flexexa_core_v1_country_defaults()->>'country_code');
alter table public.organizations alter column timezone set default (private.flexexa_core_v1_country_defaults()->>'timezone');
alter table public.organizations alter column currency set default (private.flexexa_core_v1_country_defaults()->>'currency');
alter table public.tenants alter column country_code set default (private.flexexa_core_v1_country_defaults()->>'country_code');
alter table public.tenants alter column timezone set default (private.flexexa_core_v1_country_defaults()->>'timezone');
alter table public.customers alter column locale set default (private.flexexa_core_v1_country_defaults()->>'locale');
alter table public.customers alter column timezone set default (private.flexexa_core_v1_country_defaults()->>'timezone');
alter table public.sites alter column country_code set default (private.flexexa_core_v1_country_defaults()->>'country_code');
alter table public.sites alter column timezone set default (private.flexexa_core_v1_country_defaults()->>'timezone');
