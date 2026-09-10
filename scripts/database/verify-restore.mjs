import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync,spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {compareSchemaCatalog} from './compare-schema-catalog.mjs';

for(const [k,v] of Object.entries({ALLOW_ISOLATED_DB_TESTS:'1',ALLOW_ISOLATED_RESTORE_TESTS:'1',PGHOST:'127.0.0.1',PGPORT:'54322',PGUSER:'postgres',PGDATABASE:'postgres'}))if(process.env[k]!==v)throw Error('RESTORE_REFUSES_NON_DISPOSABLE_TARGET');
const container='supabase_db_flexexa';
const inspection=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(inspection.Name,'/'+container);assert.equal(inspection.State.Running,true);
assert.ok(inspection.NetworkSettings.Ports['5432/tcp'].some(p=>p.HostPort==='54322'));
const suffix=randomUUID().replaceAll('-',''),target='flexexa_restore_'+suffix,archive='/tmp/flexexa_restore_'+suffix+'.dump';
assert.match(target,/^flexexa_restore_[0-9a-f]{32}$/u);
assert.match(archive,/^\/tmp\/flexexa_restore_[0-9a-f]{32}\.dump$/u);
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const identifier=x=>'"'+String(x).replaceAll('"','""')+'"';
const args=db=>['-h','127.0.0.1','-p','54322','-U','postgres','-d',db,'-XAtq','--set=ON_ERROR_STOP=1'];
const sql=(db,s)=>execFileSync('psql',[...args(db),'--command',s],{encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']}).trim();
const docker=(command,code,input)=>{
 try{return execFileSync('docker',['exec',...(input===undefined?[]:['-i']),'-e','PGPASSWORD',container,...command],{input,encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:[input===undefined?'ignore':'pipe','pipe','pipe']}).trim();}
 catch(error){
  // Never put dump contents, Auth material or failed COPY rows into CI logs.
  const errorCount=String(error.stderr??'').split('\n').filter(x=>/^pg_(?:dump|restore): (?:error|warning):/u.test(x)).length;
  const commandKind=String(error.stderr??'').split('\n').find(x=>x.startsWith('Command was:'))?.match(/^Command was: ([A-Z]+(?: [A-Z]+)?)/u)?.[1];
  console.error(JSON.stringify({restoreCommand:code,errorCount,commandKind}));throw Error(code);
 }
};
const sourceInfo=JSON.parse(sql('postgres',"select jsonb_build_object('major',current_setting('server_version_num')::int/10000,'address',inet_server_addr(),'database',current_database())"));
assert.equal(sourceInfo.major,17);assert.equal(sourceInfo.database,'postgres');
assert.ok(Object.values(inspection.NetworkSettings.Networks).some(n=>n.IPAddress===sourceInfo.address));
const dumpVersion=docker(['pg_dump','--version'],'RESTORE_CLIENT_CHECK_FAILED');assert.match(dumpVersion,/PostgreSQL\) 17\./u);
const [org,tenantA,tenantB,userA,userB,sessionA,sessionB,memberA,memberB,correlation]=Array.from({length:10},()=>randomUUID());
sql('postgres',`insert into auth.users(id,is_anonymous) values('${userA}',false),('${userB}',false);
insert into auth.sessions(id,user_id) values('${sessionA}','${userA}'),('${sessionB}','${userB}');
insert into public.organizations(id,name,slug) values('${org}','Restore verification','${org}');
insert into public.tenants(id,organization_id,name,slug) values('${tenantA}','${org}','Restore A','${tenantA}'),('${tenantB}','${org}','Restore B','${tenantB}');
insert into public.memberships(id,tenant_id,user_id) values('${memberA}','${tenantA}','${userA}'),('${memberB}','${tenantB}','${userB}');
insert into public.membership_roles(tenant_id,membership_id,role_id) select m.tenant_id,m.id,r.id from public.memberships m join public.roles r on r.tenant_id=m.tenant_id and r.role_key='tenant_admin' where m.id in('${memberA}','${memberB}');`);
const claims=who=>JSON.stringify({sub:who==='a'?userA:userB,session_id:who==='a'?sessionA:sessionB,role:'authenticated',aal:'aal1'});
const transaction=(who,s)=>`begin;set local role authenticated;set local request.jwt.claims=${quote(claims(who))};${s};commit;`;
const payload=JSON.stringify({customer_type:'person',display_name:'Restore probe'});
const create=(tenant,key)=>`select public.flexexa_create_customer('${tenant}',${quote(payload)}::jsonb,${quote(key)},'${correlation}')`;
const originalA=JSON.parse(sql('postgres',transaction('a',create(tenantA,'restore-probe'))));
const originalB=JSON.parse(sql('postgres',transaction('b',create(tenantB,'restore-probe'))));

let keeper,keeperLines,report,created=false;
const started=performance.now();
try{
 // One exported snapshot covers both the dump and every source fingerprint,
 // even while the disposable Auth service performs background maintenance.
 keeper=spawn('stdbuf',['-oL','psql',...args('postgres')],{stdio:['pipe','pipe','pipe']});
 keeper.stderr.resume();keeperLines=createInterface({input:keeper.stdout});
 const snapshot=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('RESTORE_SNAPSHOT_TIMEOUT')),10000);
  keeper.once('error',()=>{clearTimeout(timer);reject(Error('RESTORE_SNAPSHOT_CONNECTION_FAILED'));});
  keeper.once('exit',()=>{clearTimeout(timer);reject(Error('RESTORE_SNAPSHOT_CONNECTION_ENDED'));});
  keeperLines.once('line',line=>{clearTimeout(timer);resolve(line.trim());});
  keeper.stdin.write("set idle_in_transaction_session_timeout='120s';begin isolation level repeatable read read only;select pg_export_snapshot();\n");
 });
 assert.match(snapshot,/^[0-9A-F]+-[0-9A-F]+-[0-9]+$/u);
 const inSnapshot=s=>`begin isolation level repeatable read read only;set transaction snapshot ${quote(snapshot)};set local timezone='UTC';${s};commit;`;
 const catalogSql=fs.readFileSync('scripts/database/schema-catalog.sql','utf8');
 const sourceCatalog=JSON.parse(sql('postgres',inSnapshot(catalogSql)));
 // A logical dump omits dropped attributes, closing internal attnum gaps.
 // Preserve active column order and every other catalog property. The normal
 // migration/live parity query remains byte-for-byte unchanged.
 const positionExpression="'position',a.attnum";
 assert.equal(catalogSql.split(positionExpression).length,2,'Restore catalog position expression changed');
 const logicalCatalogSql=catalogSql.replace(positionExpression,"'position',(select count(*) from pg_catalog.pg_attribute live where live.attrelid=a.attrelid and live.attnum>0 and live.attnum<=a.attnum and not live.attisdropped)");
 const sourceLogicalCatalog=JSON.parse(sql('postgres',inSnapshot(logicalCatalogSql)));
 const tables=JSON.parse(sql('postgres',inSnapshot(`select jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname) order by n.nspname,c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private','auth','supabase_migrations') and c.relkind in ('r','p') and not exists(select 1 from pg_catalog.pg_depend d where d.classid='pg_catalog.pg_class'::regclass and d.objid=c.oid and d.deptype='e')`)));
 assert.ok(tables.length>30);
 const parts=tables.map(t=>`select ${quote(t.schema+'.'+t.name)} as relation,count(*) as rows,encode(extensions.digest(coalesce(string_agg(row_hash,'' order by row_hash),''),'sha256'),'hex') as sha256 from (select encode(extensions.digest(to_jsonb(r)::text,'sha256'),'hex') as row_hash from ${identifier(t.schema)}.${identifier(t.name)} r) data`);
 const dataSql=`select jsonb_agg(to_jsonb(f) order by relation) from (${parts.join(' union all ')}) f`;
 const sourceData=JSON.parse(sql('postgres',inSnapshot(dataSql)));
 const sequenceCount=Number(sql('postgres',inSnapshot("select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.relkind='S' and n.nspname in ('public','private','auth','supabase_migrations') and not exists(select 1 from pg_catalog.pg_depend d where d.classid='pg_catalog.pg_class'::regclass and d.objid=c.oid and d.deptype='e')")));
 const dumpStarted=performance.now();
 docker(['pg_dump','-h','127.0.0.1','-p','5432','-U','postgres','-d','postgres','--format=custom','--snapshot='+snapshot,'--lock-wait-timeout=5000','--file='+archive],'RESTORE_DUMP_FAILED');
 const dumpMs=Math.round(performance.now()-dumpStarted);
 const archiveBytes=Number(docker(['stat','-c','%s',archive],'RESTORE_ARCHIVE_STAT_FAILED'));assert.ok(archiveBytes>1000);
 const archiveSha256=docker(['sha256sum',archive],'RESTORE_ARCHIVE_HASH_FAILED').split(' ')[0];assert.match(archiveSha256,/^[a-f0-9]{64}$/u);
 keeper.stdin.end('rollback;\n');keeperLines.close();
 sql('postgres',`create database ${identifier(target)} template template0`);created=true;
 const toc=docker(['pg_restore','--list',archive],'RESTORE_TOC_FAILED');
 // --clean is inappropriate for an empty target: DROP POLICY IF EXISTS still
 // resolves its absent parent table. Retain every archive object; only remove
 // the empty default namespace when the archive itself recreates it.
 const publicToc=toc.split('\n').filter(line=>/ SCHEMA - public /u.test(line));
 const publicSchemaSql=docker(['pg_restore','--use-list=/dev/stdin','--file=-',archive],'RESTORE_NAMESPACE_READ_FAILED',publicToc.join('\n')+'\n');
 if(/^CREATE SCHEMA (?:public|"public");$/mu.test(publicSchemaSql))sql(target,'drop schema public');
 // Supabase's postgres role cannot SET ROLE to managed object owners.
 // Use the existing container-local administrator only for isolated restoration.
 assert.equal(docker(['psql','-U','supabase_admin','-d',target,'-XAtq','--set=ON_ERROR_STOP=1','--command',"select rolsuper from pg_catalog.pg_roles where rolname=current_user"],'RESTORE_ADMIN_CHECK_FAILED'),'t');
 const restoreStarted=performance.now();
 docker(['pg_restore','-U','supabase_admin','--dbname='+target,'--exit-on-error','--single-transaction',archive],'RESTORE_ARCHIVE_FAILED');
 const restoreMs=Math.round(performance.now()-restoreStarted);
 // Sequence state is not MVCC. Compare against values in the actual archive,
 // not a later source read that could race a sequence increment.
 const sequenceToc=toc.split('\n').filter(line=>/ SEQUENCE SET (?:public|private|auth|supabase_migrations) /u.test(line));
 assert.equal(sequenceToc.length,sequenceCount);
 const sequenceSql=docker(['pg_restore','--use-list=/dev/stdin','--file=-',archive],'RESTORE_SEQUENCE_READ_FAILED',sequenceToc.join('\n')+'\n');
 const sequences=[...sequenceSql.matchAll(/SELECT pg_catalog.setval\('((?:[^']|'')*)', (-?[0-9]+), (true|false)\);/gu)];
 assert.equal(sequences.length,sequenceCount);
 for(const entry of sequences){
  const name=entry[1].replaceAll("''","'");
  const relation=JSON.parse(sql(target,`select jsonb_build_object('schema',n.nspname,'name',c.relname) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where c.oid=pg_catalog.to_regclass(${quote(name)}) and c.relkind='S'`));
  const value=JSON.parse(sql(target,`select jsonb_build_object('value',last_value::text,'called',is_called) from ${identifier(relation.schema)}.${identifier(relation.name)}`));
  assert.deepEqual(value,{value:entry[2],called:entry[3]==='true'});
 }
 assert.equal(sql(target,'select current_database()'),target);
 const restoredCatalog=JSON.parse(sql(target,logicalCatalogSql));
 const parity=compareSchemaCatalog(sourceLogicalCatalog,restoredCatalog);
 assert.equal(parity.applicationCatalogMatches,true,JSON.stringify(parity.differences));
 const restoredData=JSON.parse(sql(target,"set timezone='UTC';"+dataSql));
 assert.deepEqual(restoredData,sourceData,'Restored table contents differ from the dump snapshot');
 // Actual restored authorization and idempotency, beyond schema/hash equality.
 assert.deepEqual(JSON.parse(sql(target,transaction('a',create(tenantA,'restore-probe')))),originalA);
 assert.equal(sql(target,`select count(*) from public.customers where tenant_id='${tenantA}'`),'1');
 assert.equal(sql(target,transaction('a',`select count(*) from public.customers where tenant_id='${tenantB}'`)),'0');
 assert.equal(sql(target,transaction('a',`select count(*) from public.customers where id='${originalB.resource_id}'`)),'0');
 assert.throws(()=>sql(target,transaction('a',create(tenantB,'cross-tenant'))),/PERMISSION_DENIED/u);
 assert.throws(()=>sql(target,`insert into public.sites(tenant_id,customer_id,name) values('${tenantA}','${originalB.resource_id}','Cross tenant restore probe')`),/foreign key constraint/u);
 assert.throws(()=>sql(target,`update public.audit_events set metadata_json='{}' where tenant_id='${tenantA}'`),/AUDIT_IMMUTABLE/u);
 const resumed=JSON.parse(sql(target,transaction('a',create(tenantA,'after-restore'))));assert.notEqual(resumed.resource_id,originalA.resource_id);
 assert.equal(sql(target,`select count(*) from public.customers where tenant_id='${tenantA}'`),'2');
 assert.equal(sql(target,`select count(*) from public.audit_events where tenant_id='${tenantA}'`),'2');
 assert.equal(sql(target,`select count(*) from public.outbox_events where tenant_id='${tenantA}'`),'2');
 // Restored writes must not change the source fixture or application schema.
 assert.equal(sql('postgres',`select count(*) from public.customers where tenant_id='${tenantA}'`),'1');
 assert.equal(sql('postgres',`select count(*) from public.audit_events where tenant_id='${tenantA}'`),'1');
 assert.equal(sql('postgres',`select count(*) from public.outbox_events where tenant_id='${tenantA}'`),'1');
 assert.equal(compareSchemaCatalog(sourceCatalog,JSON.parse(sql('postgres',catalogSql))).applicationCatalogMatches,true);
 report={kind:'isolated_logical_restore',sourceImage:inspection.Image,client:dumpVersion,archiveBytes,archiveSha256,
  applicationCatalogObjects:parity.actualObjects,dataTables:sourceData.length,dataRows:sourceData.reduce((sum,t)=>sum+Number(t.rows),0),
  authTables:sourceData.filter(t=>t.relation.startsWith('auth.')).length,migrationRows:sourceData.find(t=>t.relation==='supabase_migrations.schema_migrations').rows,
  exactLogicalSchemaAndData:true,schemaComparison:'active_column_order_and_all_other_catalog_properties',sequencesVerified:sequenceCount,restoredTenantIsolation:true,restoredCompositeFK:true,restoredAuditImmutability:true,restoredIdempotency:true,resumedAtomicWrites:true,sourceFixtureUnchanged:true,sourceSchemaUnchanged:true,
  dumpMs,restoreMs,totalMs:Math.round(performance.now()-started),productionPITR:false,crossClusterRolesAndSecrets:false};
}finally{
 if(keeper){keeper.stdin.destroy();keeper.kill('SIGTERM');keeperLines?.close();}
 if(created)sql('postgres',`drop database ${identifier(target)} with (force)`);
 docker(['rm','-f',archive],'RESTORE_ARCHIVE_CLEANUP_FAILED');
}
report.cleanupVerified=true;
fs.mkdirSync('.flexexa/index',{recursive:true});fs.writeFileSync('.flexexa/index/database-restore.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
