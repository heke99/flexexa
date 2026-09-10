# Application schema parity

This verification follows migration-history synchronization (merged PR #21,
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
The first candidate exposed this instrumentation defect and is not parity evidence.

## Verified development comparison

Corrected source head `3ace2dd2104689e65b7c092d6125a99a191d4deb`, tree
`5934f99e58115a46e24d7938fe71a4b5e0370ef2`, passed run `34452939530`:
application job `102792623383` and database job `102792623672`. The clean catalog
artifact contained 914 unique objects. The same query against development project
`zhgwlvmtvwjftyjmgljw` produced 914 unique objects; the strict comparator reported
zero differences. No schema repair or new migration was necessary.

Compared: 356 columns, 278 constraints, 121 indexes, 53 functions, 38 triggers,
33 relations, 27 policies, six default grants and two schemas. Full replay of all
fifteen migrations, 489 SQL assertions and all prior concurrent RPC checks passed.
The application catalog match includes function definitions and ACLs as well as
structural and RLS state; it is separate from the recorded-history formatting exceptions.

PR #22 holds final tracked-head CI and merge evidence. For every later schema change,
repeat both history synchronization and a fresh comparison against that change's clean
replay artifact. An older capture must not be presented as a current live verification.
