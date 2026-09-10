# Phase 0 — durable API identity provisioning request

This step follows merged PR #16. It records an immutable, expiring intent before
any external Auth operation. Canonical API clients remain the sole client catalog.
A tenant/client composite FK and existing receipt FK bind the private request to
its owner. The database generates its operation ID and intended Auth UUID; callers
cannot supply identities, credentials, app_metadata or authority claims.

## Behavior and limits
The request requires a live MFA administrator and current api_clients.manage on
every call, including replay. Identical actor/tenant/key retries retain the original
operation, intended UUID and correlation; conflicting payloads roll back. An intent
expires at the earlier of client expiry or fifteen minutes. This bounds an intent,
not permission or an access token. A replay returns historical evidence even after
expiry and cannot authorize external work. Different keys denote distinct requests.
No Auth user, machine binding, secret or permission is created by this boundary.

The immutable request stores canonical IDs and timing; the existing transactional
idempotency, audit and outbox tables retain the atomic receipt/evidence. The intended
Auth UUID cannot yet have an Auth FK because the user does not exist. requested_by
is historical attribution retained like the existing audit actor, not live authority.
The table has RLS and no browser grants/policies. Tenant/client index supports its
FK and scoped lookup; unique receipt and intended identity indexes prevent aliasing.

## Verification and skill routing
Activated Supabase/Postgres overlays and upstream skills, codebase-index,
impact-analysis, affected-verification, security/code review and test-strategy.
Reviewed locked sections 15, 18–22, 68, 70–71 and ADR-0004. Checked current Supabase
Auth documentation: admin createUser supports an explicit UUID; this step does not
call it. No browser or AWS changes. Existing twelve SQL files and dependency lock
remain unchanged. New migration filename created with Supabase CLI.

Local full application gates passed. Added 23 TypeScript cases, PostgreSQL negative
and ownership tests, and 16 real concurrent request calls in the permanent identity
runner. Existing 40 identity calls and all preceding tests remain required. Candidate
isolated CI must pass before exact SQL is promoted and tracked history synchronized.

## Next integration boundary
The worker needs a durable execution lease/fencing state, current authorization and
expiry revalidation, protected credential custody, explicit create/read reconciliation
using the reserved UUID, and fresh enrollment authorization. A timeout must not trigger
creation with a different UUID, user adoption by email or deletion compensation.
No worker may consume this event as an executable authorization ticket. Full Auth
provisioning, live provider consent and phase readiness are still incomplete.

## Candidate acceptance and development read-back
Run `34410181534` passed both application `102662532695` and database
`102662532898` jobs. Database logs confirm 392 pgTAP assertions, all earlier
contract/race tests, 40 identity calls and 16 provisioning request calls.
Exact candidate SQL (7,853 bytes, SHA256
`38586f78122ac7d784403b4dcc4f037fe20bb9450db2f99ea427b0985cc80be7`)
was applied to Stockholm development and recorded as `20260910062435`.
The tracked filename is synchronized to that authoritative version without SQL
changes or manual history repair. Read-back confirms the exact hash, required
indexes, RLS, no browser SELECT/INSERT, no anonymous function EXECUTE, empty
search paths and public invoker wrapper. Zero provisioning requests were created.
Security advisors have no WARN/ERROR; four INFO-only no-policy notices describe
intentionally default-denied evidence/private tables. No permissive policy added.
Final tracked-only replay still required before merge.

Runtime inventory: AWS account `938095765653`, eu-north-1, has zero ECS clusters
and zero Secrets Manager entries with name prefix `flexexa` at the read-only check.
No credential plaintext retrieved. Runtime deployment/custody is not ready.
