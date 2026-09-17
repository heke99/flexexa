# Phase 0 Collector runtime boundary

Candidate; exact final CI, image digest and merge evidence are recorded in the PR.

Active skills: repository observability, Docker local stack, impact/index/affected
verification, code/security review and test strategy. Read locked sections 72 and 83.
AWS/Vercel deployments are intentionally outside this disposable Linux fixture.
No PostgreSQL or ClickHouse migration is changed.

The real identity SDK sends HTTP server/client spans through the actual Collector
and into a protocol receiver. Tests verify parentage, allowlisted data, malformed
input rejection, disabled logs ingestion, temporary destination outage/retry/recovery,
Prometheus self-metrics, round trip after same-container restart and graceful exit.
Three negative interface probes verify receiver/health/metrics bind only to loopback.
The exact tested image must pass HIGH/CRITICAL OS and binary dependency scanning.
All existing application, database/Auth/container and other runtime jobs remain gates.

This completes only an isolated collection boundary when verified. Hosted collector,
durable trace destination, retention/access controls, dashboards, domain metrics,
alerting, AWS deployment and full Phase 0 readiness remain unfinished.
