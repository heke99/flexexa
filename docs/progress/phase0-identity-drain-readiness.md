# Phase 0 — identity admission readiness and draining

Scope: locked V1 §§71–73, 77 and 83; the admission/readiness part of FXP-01-T3.
This package does not complete that operations case, hosted deployment or Phase 0.

## Behavior

`GET /health/ready` returns 200 / `{"status":"ready"}` while this process is in
accepting mode, and 503 / `{"status":"draining"}` after its internal drain hook.
This is admission readiness, not an Auth/database connectivity probe, credential
attestation, spare-capacity guarantee or whole-product health assertion. The existing
authentication, authorization, tenant validation and eight-request limit still apply.
Health responses are fixed, no-store and disclose no tenant or credential data.

The SIGTERM entrypoint marks the managed server draining before closing HTTP.
New provisioning requests observed during drain receive the existing 503 UNAVAILABLE
before body parsing or any caller RPC / privileged Auth call. Already admitted requests
retain their existing canonical execution/reconciliation path, bounded by the existing
15-second shutdown deadline. This does not promise completion beyond that deadline;
existing lease/idempotency/ambiguous-result recovery remains necessary. There is no
public endpoint to begin drain and no change to tenant authority.

Liveness stays a process-only check. Docker's liveness healthcheck is unchanged;
readiness is separately checked by the real container fixture. Hosted load-balancer
wiring, stop timing and upstream readiness remain operations work.

## Review and evidence

Three real HTTP regressions failed before implementation: readiness was 404 and no
drain operation existed. They now prove readiness/liveness separation, no upstream
call for a denied request, admission state isolation between two servers, idempotent
drain, and completion of a previously admitted canonical RPC response while a second
request is rejected. The controlled upstream response in that regression is a fixture,
not proof of real Supabase behavior. Existing actual Auth/SQL/container CI remains
mandatory and the container fixture now probes the readiness endpoint too.

Reviewed consumers: server/entrypoint, fixed-route diagnostics, telemetry attribute
filtering, native HTTP tests, canonical provisioning callers, container fixture and
Docker liveness/SIGTERM behavior. The Collector retains the already-whitelisted
`http.route` key; no new private/free-text attribute or event authority is introduced.
No SQL, migration, API-client secret, dependency lock, IAM or deployment change.

Activated local index/impact, affected verification, code/security review, test
strategy, verification and Docker/local-stack; applied upstream full-story verification.
Story: validated process → readiness → drain admission → existing RPC completion →
bounded shutdown. Browser/UI, database-schema and AWS mutations are intentionally
skipped. The existing two-tenant/Auth/SQL/concurrency/container and image security
gates must pass on the published final head. No local Docker daemon is available.
Do not certify actual signal/container/Auth behavior from the controlled unit fixture.

Local frozen install, HIGH impact review, plan/history integrity and application-only
verification passed with Node 24.19.0 and pinned pnpm 12.3.4. All ten targeted HTTP
readiness/diagnostic tests passed after the three new failing-before regressions.
Full application lint/typecheck/tests/build passed; unaffected workspace tasks reused
their cache. The modified container fixture passed syntax inspection, but actual
container readiness, real Auth and SIGTERM must be checked in ordinary final-head CI.
