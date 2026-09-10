# Phase 0 — reserved Auth provisioning service

Candidate follows merged PR #22 (`5f08822e7d5a55352f5cb13f4d630d30f849a2f3`, final
run `34453358175`), which verified all 914 application catalog entries against development.

## Backend boundary

`apps/identity-service` is a Node backend for AWS, independent of the Vercel frontend.
POST `/v1/identity/provisioning/execute` accepts only a complete typed lease receipt,
finalization idempotency key and correlation UUID. Tenant selection is untrusted until
the caller's JWT is independently authorized by the existing Supabase RPCs. Environment
comes from trusted service configuration. No caller-supplied Auth key, URL, metadata,
password, subject substitution or arbitrary RPC name is accepted.

The service first invokes canonical finalization. A successful historical replay returns
without Auth administration; a completed/revoked identity is not reactivated. Only a
permission-denied result may continue to a separate fresh execution-lease check. That
check must validate current administrator/MFA/session/tenant ownership and all receipt
identities before the privileged client reads the exact reserved UUID.

If absent, another SQL lease check precedes Auth creation. The backend chooses the
exact reserved UUID and trusted enrollment marker, uses a synthetic non-deliverable
address and an unreturned random password. It never searches by email, rewrites an
existing marker, delivers credentials or grants API rights. A failed/ambiguous create
is followed by a fresh lease check and at most one read of the SAME UUID. No second
create is attempted within that invocation. Failure never deletes the Auth subject.
Canonical finalization rechecks current authority and writes binding/audit/outbox atomically.

SQL cannot cancel an external Auth request already in flight. If authority expires after
creation, finalization fails; the unattached subject remains for controlled reconciliation.
It receives no API grant. Reusing the same reserved UUID across recovery/concurrency
prevents creating a second logical identity; duplicate POST attempts may still occur.

## Configuration and exposure

Runtime-only configuration: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_AUTH_ADMIN_KEY`, `FLEXEXA_ENVIRONMENT`, optional `PORT` (8080).
The Auth-admin credential belongs in protected runtime binding, never a repository,
frontend bundle or PR environment. Caller RPC uses the caller JWT and a separate
publishable key; the privileged client exposes only exact-ID read and create operations.
HTTPS is mandatory in the entrypoint. An explicit loopback option exists only for
isolated tests. Redirects, unexpected response types and oversized responses fail closed.
Errors return canonical codes without upstream bodies/credentials. Requests are bounded
to 4096 bytes, eight active executions per process, five-second upstream timeouts and
limited incoming header/body time. These limits do not replace distributed rate limiting.
`/health/live` reports process liveness only, not readiness or successful provisioning.

## Verification and routing

28 unit/adapter regressions exercise fencing, historical replay, ambiguity, tampering,
foreign attestation, exact endpoints, bounded responses and error redaction. The isolated
integration test uses the real local Supabase Auth API for administrator creation, password
login, TOTP enrollment/challenge/verification, three reserved machine subjects and actual
HTTP provisioning. It covers AAL1/foreign-tenant/tampered-subject rejection, historical
replay, a lost response after real Auth commit, four concurrent HTTP calls, and committed
revocation. Local keys/JWTs/TOTP material remain in process memory and are never printed.
Business tenancy fixtures use disposable SQL; machine Auth rows use the actual Auth API.
Existing fifteen migrations and all earlier replay/RLS/concurrency checks are preserved.
Candidate CI must pass before this integration is reported verified.

Activated Supabase/Postgres, verification, index/impact/affected verification, code/security
review and test strategy. Reviewed master 18–20, 68, 70–71 and ADR-0004. CI and dependency
review apply to the new workspace importer; existing package versions/resolutions are
preserved. Browser/UI and physical-device tests do not apply to this backend boundary.

Checked primary references:
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://github.com/supabase/auth/blob/master/internal/api/admin.go
- https://supabase.com/docs/guides/auth/auth-mfa/totp

## Remaining live gates

No development Auth user has been created by this change. Protected development Auth
credential binding, container deployment, TLS/ingress, distributed rate limiting, service
observability and actual deployed smoke tests remain. AWS apply is main-only/manual via
the existing OIDC workflow; its trust policy must not be broadened to bypass release review.
Client credential issuance and API grants remain separate work. Full Phase 0 is incomplete.
