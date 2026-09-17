# Isolated RabbitMQ protocol foundation

Create a virtual environment and install `scripts/runtime/rabbitmq/requirements.txt`
with `pip install --require-hashes --only-binary=:all:`. Then run
`ALLOW_ISOLATED_RUNTIME_TESTS=1 python scripts/runtime/rabbitmq/verify.py` with Docker
Compose and Node 24 available. The runner creates and cleans only its unique project,
named volume and temporary credentials. It publishes one dynamically assigned AMQP
port on 127.0.0.1; no management UI or public network listener is exposed on the host.

RabbitMQ 4.3.5 Alpine and Pika 1.4.4 are version/hash pinned from publisher metadata.
The derived image pins libcrypto3/libssl3 to 3.5.8-r0 to fix CVE-2026-14456
found by CI in the original publisher image. No scan exclusion is used.
The broker uses UID 999, a read-only root, dropped capabilities, and bounded resources.
The only durable fixture data lives in its named volume, removed on test completion.
The bootstrap definition file contains ephemeral salted password hashes and distinct
vhost/resource permissions. It is outside Git, never printed, and removed afterwards.

The actual AMQP test uses Flexexa's canonical event parser and checks confirms,
mandatory returns, cross-vhost/environment and resource denial, unacknowledged
redelivery, dead-letter rejection, a three-attempt failed-delivery bound, two deliveries of a duplicate event and persistent
message survival across broker restart. Quorum queues here have one node: this proves
restart behavior, not multi-node failover. Default guest access is tested as denied.

RabbitMQ 4.3 counts basic.reject as a failed delivery; basic.nack requeues do not
consume the delivery limit. The test uses basic.reject for bounded failure handling.
The broker does not provide business deduplication. Durable Postgres outbox/inbox,
bounded application retries, consumer identity and observability remain required.
Production must use TLS, managed credentials, approved Amazon MQ engine/configuration,
HA and OpenTofu deployment. This local 4.3 baseline does not establish Amazon MQ
version compatibility. It executes no physical commands or commercial market events.

CI scans the image and pinned Python client for detected HIGH/CRITICAL vulnerabilities
without exclusions. Native Erlang/RabbitMQ components may not all be discoverable by
package scanners; publisher advisories and exact server-version checks are separate.

References checked 2026-09-10:
- https://www.rabbitmq.com/release-information
- https://www.rabbitmq.com/docs/definitions
- https://www.rabbitmq.com/docs/passwords
- https://www.rabbitmq.com/docs/confirms
- https://hub.docker.com/v2/repositories/library/rabbitmq/tags/4.3.5-alpine
- https://pypi.org/pypi/pika/1.4.4/json
- https://www.rabbitmq.com/docs/quorum-queues
