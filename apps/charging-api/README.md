# Charging read API — adapter-ready, not deployed

`createChargingReadServer` is a Node HTTP server factory for AWS ECS/Fargate.
It has no production entry point until an authenticated, audited database adapter
exists. No embedded credentials, anonymous production mode or service-role fallback.

| Read endpoint | Backend contract |
| --- | --- |
| GET /v1/companies/{canonical tenant UUID}/charging-overview | Recheck live session, company membership, charging-read permission and RLS using caller JWT on every read |
| GET /v1/platform/charging-overview | Recheck platform permission and persist privileged audit before returning aggregate data |

No caller-supplied role, email, vehicle registration, query tenant override or
write endpoint. Responses are strict canonical shared-package models, no-store,
with no provider IDs. Failed audit or malformed/cross-tenant upstream response
returns no business data. Upstream failures expose no raw exception text.
Local tests inject a synthetic authorizer; those tests do not establish Supabase
RLS, live token validation or deployment readiness. Adapters must honour the abort
signal; response waiting is bounded and hung operations retain an admission slot.
An external platform ingress must supply TLS, rate limits and access logging.

Public preview JSON is an explicitly synthetic build artifact. The static preview
does not call this server and does not supply evidence of authentication. Simulator
output cannot authorize a physical command. Persisted plan/run versioning, caller
JWT adapter, current RBAC/RLS queries, audit transaction, end-to-end Auth tests and
ECS rollout remain required before private user data can be served.
