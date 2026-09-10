# Phase 0 — atomic reserved-identity finalization

Follows merged PR #19. This boundary completes a provisioning intent only after its
exact reserved Auth UUID already exists with the trusted enrollment marker. It does
not create Auth users or credentials, adopt users by email, or substitute browser IDs.

## Canonical transaction
The caller supplies lease_id/environment through the standard tenant/idempotency/
correlation envelope. A current MFA administrator must be the original requester.
The function locks that immutable request, rechecks wall-time permission/session
validity, and serializes receipt lookup with completion. A new execution checks the
current lease, calls the existing canonical enrollment boundary, then checks the lease
again before recording completion. The second check catches authority lost while
enrollment waited for its Auth row. Any failure rolls back enrollment and finalization
receipts, the principal, both audits and both outbox events together.

The internal enrollment key derives from the new server-generated finalization receipt
UUID. An independently enrolled subject is not adopted through a historical enrollment
key. Existing enrollment checks still reject missing/wrong attestation, human/platform
subjects, subjects with sessions, invalid clients and existing bindings. No API grant
is issued. The canonical principal remains authoritative.

An immutable completion has its own stable UUID and unique tenant/request, tenant/lease
and tenant/principal identities. Composite foreign keys bind the same tenant and the
exact request/lease pair. Added referenced unique constraints support those ownership
relationships. Completed requests cannot reacquire a lease or pass lease checks.

Same-key finalization replay reauthorizes the original actor with a current MFA session
and returns historical evidence, including original correlation, without checking an
expired lease or reenrolling/reactivating a principal. A different key cannot complete
the request again; changed payload under the same key conflicts. A completion receipt
is not current machine permission. Revocation remains terminal.

## Verification and scope routing
Activated Supabase/Postgres, verification, codebase index/impact/affected verification,
code/security review and test strategy. Reviewed locked sections 18–20, ADR-0004,
current lease/enrollment SQL and typed consumers. Browser, provider/physical-control
and AWS deployment are intentionally outside this transaction-only change. No dependency
change; all fourteen previously applied migrations remain byte-identical in the repository.

Local application gates pass with typed finalization input/receipt/error tests. New
pgTAP cases cover tenant/session/actor ownership, attestation, terminal completion,
historical replay, immutable evidence and late rollback. A test-only after-insert
trigger invalidates the actor session after enrollment; a nontransactional sequence
proves enrollment was reached before all transactional effects rolled back. The
permanent isolated runner adds 16 actual concurrent typed finalizations and checks
that completed requests cannot reacquire. Existing replay/RLS/contracts/races remain.
Candidate isolated CI and exact development read-back are required before merge.

## Remaining integration
The privileged Auth service still needs protected credential binding, actual reserved-
UUID create/read reconciliation and runtime deployment. Database fencing cannot
cancel an external Auth call already in flight. A timeout must not create another
UUID or cause deletion compensation. Test Auth rows are isolated fixtures, not evidence
of live Auth API provisioning. Full Phase 0 and master-plan readiness remain incomplete.
