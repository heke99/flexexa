# Application schema parity

Candidate verification follows migration-history synchronization (merged PR #21,
`4b3056130855473a0669300fedb740a38af59e02`, final run `34451757476`).
History parity alone cannot detect out-of-band DDL. The database job now captures a
read-only application catalog immediately after clean replay, before any test fixtures.
The catalog and exact source commit are retained as CI artifacts.

The query fingerprints public/private application schemas, relations and ACLs, columns,
defaults, constraints, indexes, function definitions/owners/ACLs, RLS policies, triggers,
sequences, default grants and enums. OIDs, business records and Auth internals are excluded.
Extension-owned relations/functions are excluded. Roles are ordered by name rather than
environment-specific OID. A fixed search path makes generated definitions comparable.

Run the same `scripts/database/schema-catalog.sql` through a verified read-only development
connection, then compare its `catalog` object with the artifact from the exact reviewed
source using `node scripts/database/compare-schema-catalog.mjs /tmp/replay.json /tmp/dev.json`.
The comparator rejects malformed/duplicate objects and reports missing, added or changed
fingerprints. It performs no SQL normalization and no repair. Captures must come from
the correct project and current source; JSON itself is not a signed attestation.

This checks the described application catalog, not hosted Auth settings, data contents,
global roles, extensions, every PostgreSQL feature or runtime infrastructure. Keep history
verification, live ACL/RLS checks, negative tenant tests and complete flow tests separate.
No whole-plan or production readiness is implied.

Activated Supabase/Postgres, verification, codebase index/impact/affected verification,
code/security review, test strategy and CI guidance. Reviewed master sections 18–20,
70–71 and the existing workflow. Browser/provider/AWS deployment are outside this check.
Twelve comparator regressions cover actual drift and corrupt catalog handling. The
SQL union explicitly uses text for qualified names, avoiding PostgreSQL name-type
truncation at 63 bytes; capture rejects duplicate object identities before saving.
The first candidate exposed this instrumentation defect and is not parity evidence. Live
comparison against the clean CI capture is required before this step is complete.
