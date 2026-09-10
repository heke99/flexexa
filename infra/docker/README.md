# Isolated runtime foundation

Run `ALLOW_ISOLATED_RUNTIME_TESTS=1 node scripts/runtime/verify-valkey.mjs` with Docker
and Docker Compose available. The runner uses a unique project, generates ephemeral
credentials/ACL hashes outside Git, waits for health, verifies real commands and
removes its containers, network and temporary files. No host ports are published.
The Compose network is internal. Do not run `docker compose config` with credentials
in scope: resolved environment output can expose them.

Valkey 9.1.2 Alpine 3.24 is digest-pinned from the publisher's tag metadata, checked
2026-09-10. Runtime is non-root, read-only, capability-free and bounded to 128 MiB.
Health has PING only; the two synthetic tenant users have distinct key namespaces
and only the commands needed for protocol verification. Default access is disabled.

The real test covers authentication, cross-tenant and cross-environment key denial,
forbidden administrative commands, 24 competing SET NX PX requests, owner-checked
release, expiry/reacquisition and stale-owner rejection. The checked-in Lua script
is an advisory single-node primitive only: it does not provide distributed fencing,
failover durability, business idempotency or physical-control authorization.
Postgres remains authoritative. Restart deliberately loses cache state.

CI scans the exact tested image, fails on every HIGH/CRITICAL finding without
ignoring unfixed issues, and retains the runtime and scan reports. This is isolated
protocol verification, not an AWS service, production credentials or app integration.
Production needs TLS, managed authentication, failover verification, networking,
monitoring and an authorized deployment through OpenTofu. RabbitMQ, ClickHouse,
CitrineOS and simulators remain separate foundation work.

Sources:
- https://valkey.io/download/
- https://hub.docker.com/v2/repositories/valkey/valkey/tags/9.1.2-alpine3.24
- https://valkey.io/commands/set/
- https://valkey.io/topics/acl/
- https://valkey.io/topics/cli/
