-- Read-only application catalog. No row data, credentials, Auth internals or OIDs.
with namespaces as materialized (
 select n.* from pg_catalog.pg_namespace n
 cross join (select pg_catalog.set_config('search_path','',true)) config
 where n.nspname in ('public','private')
), relations as materialized (
 select c.*,n.nspname from pg_catalog.pg_class c join namespaces n on n.oid=c.relnamespace
 where c.relkind in ('r','p','v','m','S') and not exists (
  select 1 from pg_catalog.pg_depend d where d.classid='pg_catalog.pg_class'::regclass and d.objid=c.oid and d.deptype='e')
), functions as materialized (
 select p.*,n.nspname from pg_catalog.pg_proc p join namespaces n on n.oid=p.pronamespace
 where p.prokind in ('f','p') and not exists (
  select 1 from pg_catalog.pg_depend d where d.classid='pg_catalog.pg_proc'::regclass and d.objid=p.oid and d.deptype='e')
), objects(kind,key,definition) as (
 select 'schema',nspname::text,jsonb_build_object('owner',pg_catalog.pg_get_userbyid(nspowner),'acl',
  (select jsonb_agg(a::text order by a::text) from unnest(coalesce(nspacl,pg_catalog.acldefault('n',nspowner))) a)) from namespaces
 union all
 select 'relation',nspname||'.'||relname,jsonb_build_object('kind',relkind,'owner',pg_catalog.pg_get_userbyid(relowner),
  'rls',relrowsecurity,'force_rls',relforcerowsecurity,'persistence',relpersistence,'replica_identity',relreplident,
  'acl',(select jsonb_agg(a::text order by a::text) from unnest(coalesce(relacl,pg_catalog.acldefault(case when relkind='S' then 'S'::"char" else 'r'::"char" end,relowner))) a),
  'view',case when relkind in ('v','m') then pg_catalog.pg_get_viewdef(oid,false) else null end) from relations
 union all
 select 'column',r.nspname||'.'||r.relname||'.'||a.attname,jsonb_build_object('position',a.attnum,
  'type',pg_catalog.format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
  'default',pg_catalog.pg_get_expr(d.adbin,d.adrelid,false),'collation',case when a.attcollation=0 then null else a.attcollation::regcollation::text end,
  'acl',(select jsonb_agg(x::text order by x::text) from unnest(a.attacl) x))
 from relations r join pg_catalog.pg_attribute a on a.attrelid=r.oid and a.attnum>0 and not a.attisdropped
 left join pg_catalog.pg_attrdef d on d.adrelid=r.oid and d.adnum=a.attnum
 union all
 select 'constraint',r.nspname||'.'||r.relname||'.'||c.conname,jsonb_build_object('definition',pg_catalog.pg_get_constraintdef(c.oid,false),
  'validated',c.convalidated,'deferrable',c.condeferrable,'deferred',c.condeferred)
 from relations r join pg_catalog.pg_constraint c on c.conrelid=r.oid
 union all
 select 'index',r.nspname||'.'||i.relname,jsonb_build_object('definition',pg_catalog.pg_get_indexdef(i.oid),
  'valid',x.indisvalid,'ready',x.indisready,'replica_identity',x.indisreplident)
 from relations r join pg_catalog.pg_index x on x.indrelid=r.oid join pg_catalog.pg_class i on i.oid=x.indexrelid
 union all
 select 'function',nspname||'.'||proname||'('||pg_catalog.pg_get_function_identity_arguments(oid)||')',
  jsonb_build_object('definition',pg_catalog.pg_get_functiondef(oid),'owner',pg_catalog.pg_get_userbyid(proowner),
   'acl',(select jsonb_agg(a::text order by a::text) from unnest(coalesce(proacl,pg_catalog.acldefault('f',proowner))) a)) from functions
 union all
 select 'policy',r.nspname||'.'||r.relname||'.'||p.polname,jsonb_build_object('command',p.polcmd,'permissive',p.polpermissive,
  'roles',(select jsonb_agg(case when role=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role) end order by case when role=0 then 'PUBLIC' else pg_catalog.pg_get_userbyid(role) end) from unnest(p.polroles) role),
  'using',pg_catalog.pg_get_expr(p.polqual,p.polrelid,false),'check',pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid,false))
 from relations r join pg_catalog.pg_policy p on p.polrelid=r.oid
 union all
 select 'trigger',r.nspname||'.'||r.relname||'.'||t.tgname,jsonb_build_object('definition',pg_catalog.pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled)
 from relations r join pg_catalog.pg_trigger t on t.tgrelid=r.oid where not t.tgisinternal
 union all
 select 'sequence',r.nspname||'.'||r.relname,jsonb_build_object('type',pg_catalog.format_type(s.seqtypid,null),
  'start',s.seqstart,'increment',s.seqincrement,'max',s.seqmax,'min',s.seqmin,'cache',s.seqcache,'cycle',s.seqcycle)
 from relations r join pg_catalog.pg_sequence s on s.seqrelid=r.oid
 union all
 select 'default_acl',n.nspname||'.'||pg_catalog.pg_get_userbyid(d.defaclrole)||'.'||d.defaclobjtype::text,
  jsonb_build_object('acl',(select jsonb_agg(a::text order by a::text) from unnest(d.defaclacl) a))
 from namespaces n join pg_catalog.pg_default_acl d on d.defaclnamespace=n.oid
 union all
 select 'enum',n.nspname||'.'||t.typname,jsonb_build_object('labels',jsonb_agg(e.enumlabel order by e.enumsortorder))
 from namespaces n join pg_catalog.pg_type t on t.typnamespace=n.oid join pg_catalog.pg_enum e on e.enumtypid=t.oid group by n.nspname,t.typname
)
select jsonb_build_object('schema_version',1,'objects',jsonb_agg(jsonb_build_object('kind',kind,'key',key,
 'sha256',encode(extensions.digest(definition::text,'sha256'),'hex')) order by kind,key)) as catalog from objects;
