# Phase 0 machine authorization — verification ledger

## Reviewed, executed boundary
PR #13 follows merged #11 and #12. This is dedicated-session service/API-client
permission preflight, not identity/token provisioning or physical device control.
Canonical IDs, explicit tenant/environment grants, current Auth user/session and
conditional-deny behavior are documented in ADR-0003. Existing human endpoints
remain closed to mapped machine subjects; no cross-tenant admin shortcut exists.

## Proposal evidence
- Final candidate head: `5e0bd9a9d42991d023141e8a81ed365001ff2ff3`.
- Reviewed tree: `9193598cb4b62e56136710db87ccdd4b460ecc8a`.
- Candidate run `34389012242` and ordinary baseline run `34389012380`: SUCCESS.
- Earlier candidate run `34388193661`: 307 pgTAP assertions (246 retained + 61
  new), 144 SQL/TypeScript fixtures, 92 real race calls, eight typed mutation
  calls, two machine preflight calls including committed session revocation.
  Final candidate repeated the same gates after the tenant lookup index fix.
- Final artifact `10118941470`, ZIP SHA256
  `b0ea42bb02817c18379efe7e48cf30166b5ed8d83545c8670455a003bc140bb3`.
- CLI-generated candidate `20260909182638_phase0_machine_authorization.sql`:
  exactly 8,873 bytes, SQL SHA256
  `bd9e0e500374d5d63bc3f47677e2afcc8c04debd21df67b5a9705a0abb48a4c9`.
- Artifact bytes matched the reviewed source and all ten preceding migration
  files matched byte-for-byte. No dependency lock or historical SQL edits.

## Development promotion and read-back
The exact tested SQL was applied through Supabase's migration API to the
Stockholm `flexexa-dev` project. The service assigned authoritative version
`20260909183109`; the committed migration retains that version. No history repair.
Live history read-back matched all 8,873 bytes and the SHA256 above. Eleven total
versions are recorded. Private mapping RLS and browser SELECT denial, empty
function search paths, no anonymous function execution, invoker public wrapper
and full tenant/client lookup index were read back. Zero machine bindings exist.

Security advisor: no WARN/ERROR; three INFO-only default-deny/no-policy notices
for private machine bindings and existing idempotency/outbox tables. These tables
intentionally have no browser access. Do not introduce permissive policies merely
to suppress those notices. Reference:
https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy

An optional rollback-fixture probe in development was blocked by the tool before
execution; it is not counted as a passed live test. The executed behavioral tests
are the isolated CI tests and committed-session-revocation bridge above.

## Final acceptance gate
The temporary proposal workflow and duplicate proposal paths are removed. The
ordinary permanent workflow must replay the eleven committed files and execute
the new machine bridge alongside every prior gate. Final CI must pass on the
exact final head before merge; previous proposal success is not a substitute.
The migration hash is appended to the immutable-history regression inventory.

Supplemental local Node22/TypeScript5.8 checks passed 318 source tests and package
typechecks, not a replacement for pinned Node24/pnpm full application verification.

Skills: Supabase, PostgreSQL ownership/index review, repository verification,
impact analysis, code/security review and test strategy. No Next.js UI, AWS apply,
provider calls or live token issuance in this boundary. Phase0 and phases1–13
remain incomplete. Next: audited identity provisioning and consent/link/discovery,
with resource-specific authorization and audit/outbox in each transaction.
