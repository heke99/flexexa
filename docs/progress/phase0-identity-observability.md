# Phase 0 identity HTTP diagnostics

Locked §72 and correlation propagation. Active skills: repository/upstream observability,
codebase index/impact, full verification, security/code review and test strategy.
Existing Auth/Postgres/container gates are required. Browser/Vercel deployment skills
are skipped: this is the AWS-bound identity backend, with no frontend change.

The HTTP service emits one structured completion/abort record per request with a
server-generated request ID, validated correlation UUID, fixed route/method category,
status and monotonic duration. Incoming valid correlation headers support diagnostics;
the canonical provisioning body correlation takes precedence before RPC execution.
Correlation metadata is not authorization. Every request still uses its own caller
JWT and existing SQL authorization. RPC and privileged Auth calls receive their own
request's correlation header; mutable global request context is not used.

Logs use a field allowlist. No request/response body, credential, raw URL/query,
user/tenant/email, arbitrary error text or upstream diagnostic is emitted. Unknown
paths use `unmatched`, unknown methods `other`; metric-label cardinality is bounded
for these dimensions. Request/correlation IDs belong in logs, never metric labels.
Both IDs are returned as response headers. Aborted connections use diagnostic status
499. A throwing sink does not alter transaction results. The default stdout sink
drops diagnostic records when its queued output exceeds 64 KiB, avoiding unbounded
buffering; it is best-effort operational logging, not the durable PostgreSQL audit.

Local real-HTTP tests cover denial, private diagnostic redaction, parallel correlation,
response metadata and failed logging. Existing CI must also pass real PostgreSQL,
MFA/Auth recovery/concurrency and the hardened container before merge. Final tested
head/run and current database parity evidence are recorded in the PR.

Remaining §72 gates: OpenTelemetry SDK/exporter/collector, Prometheus metrics,
Grafana/CloudWatch/error monitoring, provider health and business SLA measurements,
alerting/delivery failure monitoring, trace causation across events and deployed checks.
This change does not claim those capabilities or completed Phase 0.
