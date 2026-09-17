# Phase 0 — identity OpenTelemetry boundary

Status: candidate; final exact-head CI and merge evidence belongs in the PR.

## Skill routing
Activated repository observability, Docker, codebase index, impact analysis, affected verification, code/security review and test strategy guidance. Existing Supabase/Auth verification remains mandatory because transport and container dependencies change. Vercel observability deployment is intentionally skipped: the critical backend remains AWS ECS/Fargate. No infrastructure or database migration is applied by this change.

## Scope
Pinned OpenTelemetry JS SDK 2.11.0, OTLP/HTTP exporter 0.222.0 and API 1.9.0 instrument the identity server and its RPC/Auth clients. Only the W3C traceparent is accepted and propagated. Fixed routes, method categories, random request/correlation IDs, status and timing connect allowlisted logs and spans. No user/tenant IDs, credentials, URLs, request/response bodies, baggage, vendor state or raw exceptions are exported.

`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` explicitly enables tracing; unset leaves it disabled. The URL must be HTTPS (or IPv4 loopback HTTP for a local collector), use `/v1/traces`, and have no credentials, query or fragment. `FLEXEXA_TRACE_SAMPLE_RATIO` defaults to 0.1 and must be finite within 0–1. Sampling is controlled by the service, not the incoming sampled flag. Production resource metadata is explicit, without process/host auto-detection.

The batch queue holds at most 256 spans, sends 32 at a time and exports with one concurrent request, 1-second transport and 1.5-second processor timeouts. SIGTERM drains requests before SDK shutdown within the existing 15-second deadline. Export failures cannot roll back or prevent business responses. The container installs only frozen production dependencies in a digest-pinned builder; runtime stays signature-verified, non-root and read-only.

## Verification
Real SDK HTTP export tests check concurrent parentage, log linkage, client propagation, private-value absence and business availability when the receiver fails. The existing isolated Supabase Auth/MFA/recovery/concurrency scenario additionally enables the SDK in both native and actual container execution. After shutdown it reads received OTLP, checks every execution correlation and RPC/Auth child spans and rejects known fixture secrets and identity values. This uses a protocol receiver, not a claim of a deployed OpenTelemetry Collector.

Full application gates, clean PostgreSQL replay/RLS/contracts/races, image scans and the Valkey/RabbitMQ/ClickHouse jobs must pass for the final candidate. The PostgreSQL history and application catalog must still match development. Existing migrations remain byte-identical.

## Remaining
Collector configuration/runtime/deployment, metrics, dashboards, alert routing, retention/access controls and AWS operational verification remain separate Phase 0 gates. This trace boundary does not complete observability or Phase 0.
