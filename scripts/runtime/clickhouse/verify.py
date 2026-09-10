"""Real disposable ClickHouse SQL/tenant/retention tests. No production I/O."""
import hashlib, json, os, pathlib, re, secrets, subprocess, tempfile, time
import urllib.error, urllib.request
from datetime import datetime, timedelta, timezone

if os.environ.get('ALLOW_ISOLATED_RUNTIME_TESTS') != '1':
    raise SystemExit('Refusing non-disposable runtime verification')
ROOT = pathlib.Path(__file__).resolve().parents[3]
project = 'flexexa-click-' + secrets.token_hex(6)
passwords = {u: secrets.token_hex(32) for u in ['fixture_admin', 'reader_a', 'reader_b', 'unassigned']}
tenants = ['cc000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000002']

def run(args, env, check=True):
    result = subprocess.run(['docker', *args], cwd=ROOT, env=env, text=True, capture_output=True, timeout=300)
    if check and result.returncode:
        raise RuntimeError('CLICKHOUSE_DOCKER_FAILED: '+result.stderr[-3000:])
    return result

with tempfile.TemporaryDirectory(prefix='flexexa-click-') as temporary:
    users = pathlib.Path(temporary)/'users.xml'
    digest = hashlib.sha256(passwords['fixture_admin'].encode()).hexdigest()
    users.write_text(f'''<clickhouse>
      <profiles><default><max_threads>2</max_threads><max_memory_usage>536870912</max_memory_usage><log_queries>0</log_queries></default>
      <health><readonly>1</readonly></health></profiles>
      <users><fixture_admin><password_sha256_hex>{digest}</password_sha256_hex><networks><ip>0.0.0.0/0</ip></networks><profile>default</profile><quota>default</quota><access_management>1</access_management></fixture_admin>
      <health><password></password><networks><ip>127.0.0.1</ip></networks><profile>health</profile><quota>default</quota><allow_databases><database>system</database></allow_databases></health></users>
      <quotas><default><interval><duration>3600</duration><queries>0</queries><errors>0</errors><result_rows>0</result_rows><read_rows>0</read_rows><execution_time>0</execution_time></interval></default></quotas>
    </clickhouse>''')
    users.chmod(0o644)
    env = {**os.environ, 'FLEXEXA_CLICKHOUSE_USERS': str(users)}
    compose = ['compose','--project-name',project,'--file',str(ROOT/'infra/docker/clickhouse/compose.yml')]
    try:
        run([*compose,'up','-d','--wait','--wait-timeout','120'],env)
        container = run([*compose,'ps','-q','clickhouse'],env).stdout.strip()
        config = json.loads(run(['inspect',container],env).stdout)[0]
        host = config['HostConfig']
        assert config['Config']['User']=='101:101'
        assert host['ReadonlyRootfs'] and 'ALL' in host['CapDrop']
        assert any(v.startswith('no-new-privileges') for v in host['SecurityOpt'])
        assert list(host['PortBindings'])==['8123/tcp']
        assert all(b['HostIp']=='127.0.0.1' for b in host['PortBindings']['8123/tcp'])
        port = int(run([*compose,'port','clickhouse','8123'],env).stdout.strip().rsplit(':',1)[1])
        def sql(query, user='fixture_admin', password=None, expected_code=None):
            req=urllib.request.Request(f'http://127.0.0.1:{port}/',data=query.encode(),headers={
                'X-ClickHouse-User':user, 'X-ClickHouse-Key':passwords.get(user,'') if password is None else password})
            try:
                with urllib.request.urlopen(req,timeout=15) as response: result=response.read().decode().strip()
            except urllib.error.HTTPError as error:
                message=error.read().decode()
                match=re.search(r'Code: (\d+)\.',message)
                code=int(match.group(1)) if match else None
                if expected_code is not None and code in expected_code:return ''
                # Queries can contain generated password hashes; never echo server query text.
                raise AssertionError(f'Unexpected ClickHouse HTTP {error.code}, database code {code}') from None
            if expected_code is not None:raise AssertionError('Expected database denial was not returned')
            return result
        assert sql('SELECT version()')=='26.8.2.7'
        sql('SELECT 1',password='wrong',expected_code={516})
        sql('SELECT 1',user='default',expected_code={194,516})
        sql('SELECT 1',user='health',expected_code={194,195,516})
        sql('CREATE DATABASE flexexa')
        sql((ROOT/'infra/clickhouse/migrations/0001_telemetry_v1.sql').read_text())
        sql('CREATE ROW POLICY admin_rows ON flexexa.telemetry_v1 USING 1 TO fixture_admin')
        for user in ['reader_a','reader_b','unassigned']:
            hashed=hashlib.sha256(passwords[user].encode()).hexdigest()
            sql(f"CREATE USER {user} IDENTIFIED WITH sha256_hash BY '{hashed}' SETTINGS readonly=1")
            sql(f'GRANT SELECT ON flexexa.telemetry_v1 TO {user}')
        for user,tenant in zip(['reader_a','reader_b'],tenants):
            sql(f"CREATE ROW POLICY {user}_rows ON flexexa.telemetry_v1 USING tenant_id=toUUID('{tenant}') TO {user}")
        now=datetime.now(timezone.utc)
        def row(tenant, **changes):
            result={'tenant_id':tenant,'organization_id':None,'site_id':'cc000000-0000-4000-8000-000000000003',
                'asset_id':'cc000000-0000-4000-8000-000000000004','provider_id':'cc000000-0000-4000-8000-000000000005',
                'event_time':now.strftime('%Y-%m-%d %H:%M:%S.%f')[:-3], 'metric':'power','value_float':3.5,
                'value_string':None,'value_bool':None,'unit':'kW','source':'isolated-fixture','quality':'measured',
                'sequence_number':1,'correlation_id':'cc000000-0000-4000-8000-000000000006','tags':{'fixture':'v1'}}
            return {**result,**changes}
        def insert(record, **options):return sql('INSERT INTO flexexa.telemetry_v1 FORMAT JSONEachRow\n'+json.dumps(record),**options)
        for tenant in tenants:insert(row(tenant))
        for user,tenant,other in [('reader_a',tenants[0],tenants[1]),('reader_b',tenants[1],tenants[0])]:
            assert sql('SELECT count() FROM flexexa.telemetry_v1',user)=='1'
            assert sql(f"SELECT count() FROM flexexa.telemetry_v1 WHERE tenant_id=toUUID('{other}')",user)=='0'
            assert sql('SELECT toString(tenant_id) FROM flexexa.telemetry_v1',user)==tenant
            insert(row(other),user=user,expected_code={164,497})
            sql('DROP TABLE flexexa.telemetry_v1',user,expected_code={164,497})
        assert sql('SELECT count() FROM flexexa.telemetry_v1','unassigned')=='0'
        for invalid in [row(tenants[0],value_string='also set'),row(tenants[0],value_float=None),row(tenants[0],unit=''),row('00000000-0000-0000-0000-000000000000')]:
            insert(invalid,expected_code={469})
        insert(row(tenants[0],value_float=None,value_bool=True,metric='online',unit='1',sequence_number=2))
        insert(row(tenants[0],value_float=None,value_string='charging',metric='status',unit='1',sequence_number=3))
        assert sql("SELECT sum(value_float), countIf(value_bool), countIf(value_string='charging') FROM flexexa.telemetry_v1",'reader_a')=='3.5\t1\t1'
        assert sql("SELECT type FROM system.columns WHERE database='flexexa' AND table='telemetry_v1' AND name='event_time'")=="DateTime64(3, 'UTC')"
        insert(row(tenants[0],event_time=(now-timedelta(days=31)).strftime('%Y-%m-%d %H:%M:%S'),sequence_number=9))
        sql('OPTIMIZE TABLE flexexa.telemetry_v1 FINAL')
        assert sql('SELECT count() FROM flexexa.telemetry_v1')=='4'
        run([*compose,'restart','clickhouse'],env)
        run([*compose,'up','--no-recreate','-d','--wait','--wait-timeout','120'],env)
        assert run([*compose,'ps','-q','clickhouse'],env).stdout.strip()==container
        port=int(run([*compose,'port','clickhouse','8123'],env).stdout.strip().rsplit(':',1)[1])
        assert sql('SELECT count() FROM flexexa.telemetry_v1','reader_a')=='3'
        assert sql('SELECT count() FROM flexexa.telemetry_v1','reader_b')=='1'
        assert sql('SELECT count() FROM flexexa.telemetry_v1','unassigned')=='0'
        run([*compose,'stop','--timeout','20','clickhouse'],env)
        assert run(['inspect','--format','{{.State.ExitCode}}',container],env).stdout.strip()=='0'
        report={'image':config['Image'],'server_version':'26.8.2.7','tenant_read_isolation':True,'tenant_writes_denied':True,
            'unassigned_reader_denied':True,'invalid_rows_rejected':4,'typed_value_roundtrip':True,'retention_days':30,
            'expired_row_removed':True,'restart_data_and_policy_persisted':True,'non_root_uid':101,'read_only':True,
            'loopback_http_only':True,'postgres_identity_integration':False,'production_deployed':False}
        output=ROOT/'.flexexa/index/clickhouse-runtime.json';output.parent.mkdir(parents=True,exist_ok=True)
        output.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
    finally:
        run([*compose,'down','--volumes','--remove-orphans'],env)
