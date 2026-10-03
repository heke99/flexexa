# Attested customer consent lifecycle

Source base: PR #55 follow-up `0d68e6024b5b0b0874d9c34a4b6e32c77c703df9`.
The PR targets `phase/0-foundation`, where ordinary CI is enabled. Prerequisites
#51 and the reviewed #53/#54/#55 stack are merged at foundation `3f3952db`.
Scope: V1 §§18–21, 66, 71, 79, 83; preparation for FXP-02-T1/T2.
This is a foundation transaction package, not Phase 1 acceptance.
Relevant source-point IDs include `S21-3547ffa2ba6529bd-1` (grant),
`S21-e2416224dcb35d9b-1` (revoke), `S66-4c7ad40c65a447d6-1` (consent model)
and `S79-2abe7346811fa73b-1` (manipulated-tenant rejection).

## Implemented boundary

The session-bound typed API calls named PostgreSQL RPCs to record attested consent,
revoke it and inspect its current validity. Consent belongs to the canonical tenant
and customer, optionally to one exact site or asset. Composite foreign keys enforce
the complete customer/site/asset ownership tuple even for privileged inserts.
An asset scope requires its site; explicit nulls identify customer/site scopes.
There is no implicit parent inheritance. Consent IDs are independent of providers.

Seven purposes stay independent: smart charging, remote control, flex participation,
data sharing, vehicle API, location and market participation. Sandbox/production
and the version of customer consent wording are explicit. This `policy_version`
does not replace a Kernel rule publication or its own approval/readiness process.

`consents.manage` requires MFA and records evidence already verified by the operator
or upstream customer flow. It is not a cryptographic signature verifier. System
tenant administrators receive this permission; operator/support/viewer templates
receive status reads only. Existing custom roles receive no implicit permissions.
Customer self-service authentication/delegation remains a separate boundary.

Only an opaque evidence reference and SHA-256 enter the protected `evidence_json`;
documents, URLs, arbitrary JSON and credentials are rejected. Ordinary authenticated
reads cannot select evidence or grantor/revoker identity. RLS has no platform bypass.
Privileged updates cannot change the original owner, scope, expiry, wording or evidence;
the only transition is granted to revoked, and deletion is denied.

Grants use database time and finite future expiry. A database exclusion constraint
rejects overlapping grants for the same exact owner/scope/environment/purpose,
including simultaneous requests with different idempotency keys. Expired or revoked
grants remain historical; regranting creates a new ID. Receipt retries retain the
original result/correlation, reauthorize the actor, and never assert current validity.

Grant/revoke, the existing durable idempotency receipt, audit and outbox fact commit
atomically. Failed requests leave no partial records. The outbox carries only the
consent resource ID and explicit environment; sensitive evidence and owner IDs do
not enter event payloads. Existing RabbitMQ delivery can consume this envelope,
but this package starts no hosted worker or subscriber.

`flexexa_check_consent` pins the original consent ID, full owner tuple, environment,
purpose and wording version. It reads active ownership, status and expiry using the
current database clock, and holds parent/consent share locks until transaction end.
Revocation locks the same consent exclusively. A decision returned to an application
is a point-in-time prerequisite, not dispatch authority. Future command transactions
must call this boundary atomically and recheck immediately before external send.
This package does not implement a command queue or prove cancellation of physical I/O.

## Tests and verification

- Shared invalid/valid fixtures run through TypeScript and the actual SQL normalizer.
- Typed API tests bind expected tenant, named RPC, full scope, original receipts and
  sanitized errors, and reject mismatched validity responses before granting authority.
- pgTAP tests cover MFA, permissions/RLS, two tenants and sibling ownership, hidden
  evidence, immutable history, overlap/expiry, regrant, archival, revocation and rollback.
- `verify-consents.mjs` exercises real typed SQL round trips and 60 concurrent calls:
  same-key grants, conflicting payloads, distinct-key overlaps, and same/distinct-key
  revocations. Real held transactions test both read/revoke lock directions; a later
  check rejects the old consent after revocation and regrant. Another held revocation
  forces a grant to wait on the exclusion constraint; after observing its actual lock
  wait, the test suspends the actor and verifies denial/rollback after the wait.
- Full `verify:affected -- --base 0d68e602` passed local application lint/typecheck/tests/
  build. Exit 2 explicitly retains specialized database/workflow/review gates. Local
  Docker is unavailable; clean Supabase replay and actual concurrency run in ordinary CI.

Final source/run/artifact evidence is recorded in the PR discussion after inspecting
the actual jobs. No candidate-only result is recorded as verified FXP delivery.
The CLI-generated candidate was reviewed at `7e7ce1c`; its final exclusion-wait
follow-up was independently inspected at `c87b24b`. All ordinary final-head
workflows passed: quality `37155554445`, database/runtime `37155554405` (seven jobs),
and AWS plan `37155554414`. The actual database job passed 874 SQL assertions,
171 shared fixtures, 60 concurrent calls and the observed actor-suspension case.
Final atomic counts are six consents, five revoked, eleven receipts/audits/outbox
facts each and zero unfinished receipts; no physical commands were sent.

The exact reviewed SQL was promoted to development on 2026-10-03. Supabase assigned
authoritative version `20261003214306`; the source filename now follows that history
entry and the applied ledger pins its unchanged SQL hash
`ee724c3005027c5bf87a03294f763e4f504e03e660e7661a0cccfcb951249737` (20,196 bytes).
All preceding 20 versions/names/bytes/hashes and source files remain unchanged.
Readback at 21:43 UTC has 21 migration entries and exactly the 1,396 reviewed clean
CI catalog fingerprints, with zero additions/removals/changed fingerprints relative
to that artifact. The new table has zero rows, two consent permissions are present,
management requires MFA, and no public table lacks RLS. No customer data was seeded.
This schema promotion does not verify a hosted customer/Auth/UI/control flow.
The filename/ledger/readback metadata follow-up retains ordinary source CI gates.

The `assets` owner-key constraint builds a blocking unique index. Read-only development
inspection at 2026-10-03 21:30 UTC found zero asset rows and 114,688 relation bytes,
so that build is bounded for this specific small development target. Recheck size and
lock availability immediately before promotion. Larger populated installations require
a separately reviewed concurrent index build outside the migration transaction,
then `ADD CONSTRAINT ... UNIQUE USING INDEX`; this is not a production online-build plan.

## Consumer and skill routing

Activated: Supabase/Postgres, codebase index, impact/affected verification, code/security
review, test strategy, database performance and full-story verification. Monorepo/CI
overlays apply to the two additive package exports and one guarded test step.
Conditional: real Auth/customer UI, browser, Enode/OCPP, hosted credentials and AWS.
Skipped: UI rendering, deployment, market/settlement, pricing and physical actuation.

Consumers reviewed: shared domain/API imports, existing core/provider transports,
tenant role seeding and temporal permissions, canonical owner constraints, idempotency,
audit/outbox, RabbitMQ envelope, isolated replay/parity and logical-restore capture.
No vendor schema enters the canonical model. No network client, dependency, secret,
workflow credential scope or infrastructure resource is added.

Phase 0 remains open. The full 88-section/14-phase V1 and ten FXP requirements remain
intact, and `plan:ready` must remain false until all required evidence exists.
