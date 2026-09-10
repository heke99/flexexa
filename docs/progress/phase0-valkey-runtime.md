# Phase 0 — isolated Valkey runtime

Scope: locked §§29, 77, 83. Active skills: Docker/local-stack, Valkey,
verification, index/impact, code/security review and test strategy. RabbitMQ and
ClickHouse skills were consulted for the remaining runtime boundary; they are not
implemented by this change. No provider, UI or AWS resource change.

A pinned, isolated Compose service and disposable protocol runner verify actual
Valkey health/auth, namespace ACLs, advisory lease races/expiry/owner-safe release,
cache loss on restart and clean shutdown. Secrets exist only for that test run;
no production values are requested or used. No ports are published.

Candidate run `34463315330`: the real Valkey job `102825973606` passed all
runtime checks. Artifact `10146481892` was read back: 23 Alpine 3.24.1 OS
packages, zero HIGH/CRITICAL findings. Trivy reports no language manifests;
coverage does not include the source-built Valkey binary. The official 9.1.2
security release and publisher digest were reviewed separately. The runner now
also asserts server version and actual Docker internal-network isolation.

Final full application, database/Auth/container and Valkey CI evidence is in PR #26.
No Docker daemon is available in the editing workspace; real runtime evidence
comes from the isolated GitHub job, not local static checks.

Remaining: application client integration, production TLS/ACL identity and
failover, managed AWS provisioning, runtime monitoring, RabbitMQ/ClickHouse,
and full Phase 0 acceptance. Advisory Valkey leases never replace durable
Postgres idempotency, fencing or device safety invariants.
