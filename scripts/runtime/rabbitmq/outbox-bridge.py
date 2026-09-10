"""Isolated test adapter: real mandatory persistent publish with broker confirms."""
import json, logging, os, sys, subprocess
import pika
if os.environ.get('ALLOW_ISOLATED_DB_TESTS') != '1' or os.environ.get('FLEXEXA_OUTBOX_BROKER_TEST') != '1':
    raise SystemExit('Refusing non-disposable outbox broker test')
logging.getLogger('pika').setLevel(logging.CRITICAL)
request = json.load(sys.stdin)
connection = pika.BlockingConnection(pika.ConnectionParameters('127.0.0.1', int(os.environ['FLEXEXA_TEST_AMQP_PORT']), 'ci_tenant_a',
    pika.PlainCredentials('tenant_a', os.environ['FLEXEXA_TEST_AMQP_PASSWORD']), heartbeat=15, socket_timeout=5, blocked_connection_timeout=5, connection_attempts=1))
try:
    channel = connection.channel()
    channel.confirm_delivery()
    if request['operation'] == 'publish':
        m = request['message']
        channel.basic_publish('flexexa.events', m['event_type'], m['body'].encode(),
            pika.BasicProperties(content_type='application/json', delivery_mode=2, message_id=m['message_id'], correlation_id=m['correlation_id'], type=m['event_type']), mandatory=True)
        result = {'confirmed': True}
    elif request['operation'] in ('consume_policy', 'consume_policy_lost_ack'):
        method, props, body = channel.basic_get('flexexa.policy.q', auto_ack=False)
        result = None
        if method:
            event = json.loads(body)
            assert props.message_id == event['event_id'] and props.delivery_mode == 2
            child = subprocess.Popen(['node', '--experimental-strip-types', 'scripts/runtime/rabbitmq/inbox-bridge.mjs'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
            try:
                child.stdin.write(json.dumps({'event':event, 'scope':request['scope'], 'claims':request['claims']})+'\n');child.stdin.flush()
                message = json.loads(child.stdout.readline())
                assert message == {'operation':'ack'}, message
                if request['operation'] == 'consume_policy_lost_ack':
                    connection.close()  # DB committed; exact broker delivery remains unacknowledged.
                    reply = {'error':'SIMULATED_ACK_LOSS'}
                else:
                    channel.basic_ack(method.delivery_tag)
                    reply = {'ack':True}
                child.stdin.write(json.dumps(reply)+'\n');child.stdin.flush()
                result = {'redelivered':method.redelivered, 'consumer':json.loads(child.stdout.readline())}
                child.stdin.close()
                assert child.wait(timeout=15) == 0
            finally:
                if child.poll() is None:
                    child.kill();child.wait()
    elif request['operation'] == 'consume':
        method, props, body = channel.basic_get('flexexa.outbox.q', auto_ack=False)
        result = None if method is None else json.loads(body)
        if method:
            assert props.message_id == result['event_id'] and props.delivery_mode == 2
            channel.basic_ack(method.delivery_tag)
    else:
        raise ValueError('UNKNOWN_OPERATION')
    print(json.dumps(result))
finally:
    if connection.is_open: connection.close()
