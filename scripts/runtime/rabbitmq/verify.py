"""Disposable AMQP protocol verification, never a production consumer/outbox."""
import base64, hashlib, json, logging, os, pathlib, secrets, subprocess, tempfile, time
if os.environ.get('ALLOW_ISOLATED_RUNTIME_TESTS') != '1':
    raise SystemExit('Refusing non-disposable runtime verification')
import pika
logging.getLogger('pika').setLevel(logging.CRITICAL)
ROOT = pathlib.Path(__file__).resolve().parents[3]
project = 'flexexa-rabbit-' + secrets.token_hex(6)
passwords = {u: secrets.token_hex(32) for u in ['tenant_a', 'tenant_b']}

def password_hash(password):
    salt = secrets.token_bytes(4)
    return base64.b64encode(salt + hashlib.sha256(salt + password.encode()).digest()).decode()

def run(args, env, check=True):
    result = subprocess.run(['docker', *args], cwd=ROOT, env=env, text=True, capture_output=True, timeout=300)
    if check and result.returncode:
        message = result.stderr
        for password in passwords.values():
            message = message.replace(password, '[redacted]')
        raise RuntimeError('RABBITMQ_RUNTIME_FAILED: ' + message)
    return result

def wait_message(channel, queue):
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        result = channel.basic_get(queue, auto_ack=False)
        if result[0]:
            return result
        time.sleep(0.05)
    raise AssertionError('Message delivery deadline exceeded')

with tempfile.TemporaryDirectory(prefix='flexexa-rabbit-') as temporary:
    definitions = pathlib.Path(temporary) / 'definitions.json'
    definitions.write_text(json.dumps({'users': [{'name': u, 'password_hash': password_hash(p), 'hashing_algorithm': 'rabbit_password_hashing_sha256', 'tags': []} for u,p in passwords.items()],
        'vhosts': [{'name': 'ci_'+u} for u in passwords],
        'permissions': [{'user': u, 'vhost': 'ci_'+u, 'configure': r'^flexexa\.', 'write': r'^flexexa\.', 'read': r'^flexexa\.'} for u in passwords]}))
    definitions.chmod(0o644)
    env = {**os.environ, 'FLEXEXA_RABBITMQ_DEFINITIONS': str(definitions)}
    compose = ['compose', '--project-name', project, '--file', str(ROOT/'infra/docker/rabbitmq/compose.yml')]
    connection = None
    try:
        run([*compose, 'up', '-d', '--wait', '--wait-timeout', '120'], env)
        container = run([*compose, 'ps', '-q', 'rabbitmq'], env).stdout.strip()
        host = json.loads(run(['inspect', '--format', '{{json .HostConfig}}', container], env).stdout)
        assert host['ReadonlyRootfs'] and 'ALL' in host['CapDrop']
        assert any(v.startswith('no-new-privileges') for v in host['SecurityOpt'])
        assert list(host['PortBindings']) == ['5672/tcp']
        assert all(b['HostIp'] == '127.0.0.1' for b in host['PortBindings']['5672/tcp'])
        assert run([*compose, 'exec', '-T', 'rabbitmq', 'id', '-u'], env).stdout.strip() == '999'
        version = run([*compose, 'exec', '-T', 'rabbitmq', 'rabbitmq-diagnostics', '-q', 'server_version'], env).stdout.strip()
        assert version == '4.3.5', version
        port = int(run([*compose, 'port', 'rabbitmq', '5672'], env).stdout.strip().rsplit(':', 1)[1])
        def connect(user='tenant_a', vhost='ci_tenant_a', password=None):
            return pika.BlockingConnection(pika.ConnectionParameters('127.0.0.1', port, vhost,
                pika.PlainCredentials(user, passwords.get(user) if password is None else password),
                socket_timeout=5, blocked_connection_timeout=5, connection_attempts=1, heartbeat=15))
        def connect_ready():
            deadline=time.monotonic()+20
            while True:
                try:return connect()
                except (pika.exceptions.ProbableAuthenticationError,pika.exceptions.ProbableAccessDeniedError):raise
                except pika.exceptions.AMQPConnectionError:
                    if time.monotonic()>=deadline:raise
                    time.sleep(0.2)
        ready=connect_ready();ready.close()
        negatives = 0
        for user,vhost,password in [('tenant_a','ci_tenant_b',passwords['tenant_a']), ('tenant_a','production',passwords['tenant_a']), ('tenant_a','ci_tenant_a','wrong'), ('guest','ci_tenant_a','guest')]:
            try:
                unexpected=connect(user,vhost,password)
            except (pika.exceptions.ProbableAuthenticationError,pika.exceptions.ProbableAccessDeniedError):
                negatives += 1
            except pika.exceptions.ConnectionClosedByBroker as error:
                assert error.reply_code in (403,530)
                negatives += 1
            else:
                unexpected.close()
                raise AssertionError('Unauthorized connection accepted')
        connection = connect()
        channel = connection.channel()
        channel.confirm_delivery()
        for exchange in ['flexexa.events', 'flexexa.dead', 'flexexa.retry']:
            channel.exchange_declare(exchange, exchange_type='direct', durable=True)
        channel.queue_declare('flexexa.dead.q', durable=True, arguments={'x-queue-type':'quorum'})
        channel.queue_bind('flexexa.dead.q', 'flexexa.dead', 'failed')
        channel.queue_declare('flexexa.events.q', durable=True, arguments={'x-queue-type':'quorum', 'x-dead-letter-exchange':'flexexa.dead', 'x-dead-letter-routing-key':'failed'})
        channel.queue_bind('flexexa.events.q','flexexa.events','asset.connected')
        channel.queue_declare('flexexa.retry.q', durable=True, arguments={'x-queue-type':'quorum', 'x-delivery-limit':2, 'x-dead-letter-exchange':'flexexa.dead', 'x-dead-letter-routing-key':'failed'})
        channel.queue_bind('flexexa.retry.q','flexexa.retry','asset.connected')
        denied = connection.channel()
        try:
            denied.queue_declare('foreign.queue')
        except pika.exceptions.ChannelClosedByBroker as error:
            assert error.reply_code == 403
            negatives += 1
        else:
            raise AssertionError('Foreign resource accepted')
        event=json.loads(subprocess.check_output(['node','--experimental-strip-types',str(ROOT/'scripts/runtime/rabbitmq/event-fixture.mjs')],cwd=ROOT,text=True))
        body=json.dumps(event).encode()
        props=pika.BasicProperties(content_type='application/json', delivery_mode=2, message_id=event['event_id'], correlation_id=event['correlation_id'], type=event['event_type'])
        channel.basic_publish('flexexa.events','asset.connected',body,props,mandatory=True)
        try:
            channel.basic_publish('flexexa.events','unbound',body,props,mandatory=True)
        except pika.exceptions.UnroutableError:
            unroutable=True
        else:
            raise AssertionError('Unroutable publish was not returned')
        method,received,message=wait_message(channel,'flexexa.events.q')
        assert json.loads(message)==event and received.message_id==event['event_id']
        connection.close()  # no ACK: another connection must receive the same message again
        connection=connect();channel=connection.channel();channel.confirm_delivery()
        method,received,message=wait_message(channel,'flexexa.events.q')
        assert method.redelivered and json.loads(message)==event
        channel.basic_nack(method.delivery_tag,requeue=False)
        method,received,message=wait_message(channel,'flexexa.dead.q')
        assert json.loads(message)==event and received.headers['x-death'][0]['reason']=='rejected'
        channel.basic_ack(method.delivery_tag)
        channel.basic_publish('flexexa.retry','asset.connected',body,props,mandatory=True)
        for attempt in range(3):
            method,received,message=wait_message(channel,'flexexa.retry.q')
            assert (received.headers or {}).get('x-delivery-count',0)==attempt
            channel.basic_reject(method.delivery_tag,requeue=True)
        method,received,message=wait_message(channel,'flexexa.dead.q')
        assert json.loads(message)==event and received.headers['x-death'][0]['reason']=='delivery_limit'
        channel.basic_ack(method.delivery_tag)
        # Broker delivery is at least once, not business deduplication.
        for _ in range(2):channel.basic_publish('flexexa.events','asset.connected',body,props,mandatory=True)
        for _ in range(2):
            method,received,message=wait_message(channel,'flexexa.events.q')
            assert received.message_id==event['event_id'];channel.basic_ack(method.delivery_tag)
        channel.basic_publish('flexexa.events','asset.connected',body,props,mandatory=True)
        connection.close();connection=None
        run([*compose,'restart','rabbitmq'],env)
        run([*compose,'up','-d','--wait','--wait-timeout','120'],env)
        port = int(run([*compose, 'port', 'rabbitmq', '5672'], env).stdout.strip().rsplit(':', 1)[1])
        connection=connect_ready();channel=connection.channel()
        method,received,message=wait_message(channel,'flexexa.events.q')
        assert json.loads(message)==event;channel.basic_ack(method.delivery_tag)
        connection.close();connection=None
        run([*compose,'stop','--timeout','15','rabbitmq'],env)
        assert run(['inspect','--format','{{.State.ExitCode}}',container],env).stdout.strip()=='0'
        report={'server_version':version,'publisher_confirms':True,'canonical_event_roundtrip':True,'unauthorized_cases':negatives,
            'unroutable_return':True,'unacked_redelivered':True,'dead_letter_verified':True,'duplicate_deliveries':2,'bounded_failed_deliveries':3,
            'persistent_message_survives_restart':True,'non_root_uid':999,'read_only':True,'loopback_amqp_only':True,
            'production_deployed':False,'durable_business_deduplication':False}
        output=ROOT/'.flexexa/index/rabbitmq-runtime.json';output.parent.mkdir(parents=True,exist_ok=True);output.write_text(json.dumps(report,indent=2)+'\n')
        print(json.dumps(report))
    finally:
        if connection and connection.is_open:connection.close()
        run([*compose,'down','--volumes','--remove-orphans'],env)
