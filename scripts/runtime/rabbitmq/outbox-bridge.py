"""Isolated test adapter: real mandatory persistent publish with broker confirms."""
import json, logging, os, sys
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
    connection.close()
