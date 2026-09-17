# Phase 0 — typed identity lease transport

Follows merged PR #18 and its exact verified development migration. Adds a bounded
client for the existing acquire/check RPCs. No SQL, schema, dependency or infrastructure
change. The same fourteen tracked migrations remain immutable.

The trusted tenant/environment scope is copied at construction. Acquisition validates
the mutation envelope before I/O and accepts only request_id/environment as payload.
The receipt decoder checks exact fields, request identity, scope, server status,
idempotency key, canonical UUIDs and positive PostgreSQL integer generation. Replays
retain the original server correlation rather than substituting the latest request's.

A check validates its prior receipt, sends only tenant_id/lease_id and validates every
returned identity, environment, generation and deadline against that receipt. Every
check performs fresh SQL I/O. No local clock comparison, cached success or receipt
can grant authority. Network and database errors are sanitized without automatic
retry, release, compensation or implicit Auth work.

## Timestamp precision
PostgreSQL JSON timestamptz responses in the configured UTC environment use Z or
+00:00 and up to six fractional digits. The transport validates the calendar through
the existing canonical UTC validator and preserves all six microsecond digits in
its normalized SQL receipt. It never rounds a lease deadline forward or silently
discards precision. Non-UTC/invalid calendar/infinite timestamps fail closed.
This receipt field is not a replacement for the domain's millisecond UtcInstant.

## Verification and routing
Activated Supabase/Postgres, verification, codebase index/impact/affected verification,
code/security review and test strategy. Reviewed the lease SQL, original identity
transport consumers, master sections 18–20 and current BUILD_STATUS. Browser/provider,
AWS deployment and credential access are intentionally outside this code-only step.

Full local application gates pass. Added tests cover scope injection, malformed
responses, generations, microsecond differences, errors and no cached authorization.
The permanent database runner now sends the existing 24 concurrent lease acquisitions
and two generation checks through this typed client, preserving all previous tests
and assertions. Isolated tracked replay/RLS/contracts/concurrency must pass before
merge; unit doubles alone are not database or live provisioning acceptance.
Final run `34448449838` passed both jobs, including 445 pgTAP assertions and the
24 typed lease acquisitions/two checks. PR #19 merged as
`b238718b09e8a78fe41edcaefd480e00dd9e17db`.

## Next boundary
The privileged provisioning service still needs protected Auth credentials,
reserved-UUID create/read reconciliation and an atomic finalization check in the
write transaction (next candidate: `phase0-identity-finalization.md`). A successful SQL lease check cannot fence a remote Auth request
already in flight. There is no Auth user, credential, API grant, provider command,
deployed AWS worker or whole-plan readiness claim in this change.
