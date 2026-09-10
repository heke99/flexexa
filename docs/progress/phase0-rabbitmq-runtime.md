# Phase 0 RabbitMQ runtime

Locked §§31/77/83. Active skills: RabbitMQ, Docker/local-stack, verification,
codebase index/impact, code/security review and test strategy. AWS deployment and
provider integration are separate work; no AWS or PostgreSQL state is changed.

The isolated real-AMQP boundary is implemented with the canonical event envelope,
vhost/resource permissions, publisher confirms/returns, redelivery, dead letters,
duplicate-delivery visibility and persistent restart. This is not the durable
business outbox/inbox or a production consumer. No exactly-once claim is made.

Full tracked application/database/Auth/Valkey plus new RabbitMQ protocol and image/
client scan gates must pass before merge. CI/merge evidence is recorded in the PR.
No local Docker daemon is available: static checks alone cannot complete this gate.

Remaining: production TLS/HA, scoped service credentials, RabbitMQ-compatible AWS
engine qualification, durable outbox/inbox and retry orchestration, observability,
ClickHouse and the remaining Phase 0 acceptance checks.
