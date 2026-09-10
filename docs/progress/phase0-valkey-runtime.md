# Phase 0 — isolated Valkey runtime

Scope: locked §§29, 77, 83. Active skills: Docker/local-stack, Valkey,
verification, index/impact, code/security review and test strategy. RabbitMQ and
ClickHouse skills were consulted for the remaining runtime boundary; they are not
implemented by this change. No provider, UI or AWS resource change.

A pinned, isolated Compose service and disposable protocol runner verify actual
Valkey health/auth, namespace ACLs, advisory lease races/expiry/owner-safe release,
cache loss on restart and clean shutdown. Secrets exist only for that test run;
no production values are requested or used. No ports are published.

Validation pending: full application and existing database/Auth/container gates,
new real Valkey runtime gate and its zero-HIGH/CRITICAL vulnerability scan.
No Docker daemon is available in the editing workspace; syntax/static checks
are not substitutes for the isolated GitHub runtime result.

Remaining: application client integration, production TLS/ACL identity and
failover, managed AWS provisioning, runtime monitoring, RabbitMQ/ClickHouse,
and full Phase 0 acceptance. Advisory Valkey leases never replace durable
Postgres idempotency, fencing or device safety invariants.
