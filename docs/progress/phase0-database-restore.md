# Phase 0 logical database restore — verified isolated exercise

Scope: locked §§73, 77 and 84/DoD and Phase 0 database recovery. The isolated CI exercise
uses the running PostgreSQL 17 container's own client binaries, with explicit local
host/port/database and container identity guards. It cannot select a hosted project.
A unique newly created destination is the only database the cleanup may drop.

The source exports a repeatable-read snapshot. The custom-format dump and source
schema/data fingerprints use that exact snapshot, so background Auth maintenance
cannot produce a false mismatch. The archive is restored into a separate database
with ownership/ACLs retained, fail-on-error and a single restore transaction.
The existing container-local `supabase_admin` restores managed object owners; the
script verifies that role is a superuser without changing cluster role grants.
An empty target needs no `--clean`; its default public namespace is removed only
when the actual archive recreates it.

Verification compares every application catalog object and ordered SHA-256 row
fingerprints for all public/private/Auth/migration tables and archived sequence values,
then actually exercises
restored RLS, cross-tenant FK rejection, immutable audit, historical idempotency and
new atomic customer/audit/outbox writes. New writes must leave the source untouched.
Logical restore omits dropped-column slots. Only this restore comparison normalizes
column position to active column order; types, defaults, constraints, ACLs, owners,
RLS, functions and every other catalog property remain compared. The permanent
live-versus-migration catalog query is unchanged. The two existing dropped-column
gaps in `asset_capabilities` and `metering_points` exercise this distinction.

The temporary destination and archive are removed; only non-secret verification
metadata is retained, never dump contents or Auth records.

This is a same-cluster logical restore exercise. It does not certify production PITR,
cross-region recovery, global role/secret restoration, S3 object recovery, a backup
retention policy or production RPO/RTO. Those remain operational gates. Recorded
durations describe only this disposable fixture workload.

Skills: Supabase/Postgres, Docker/local stack, verification, index/impact/affected
verification, code/security review, test strategy, performance and CI are active.
AWS/provider/browser actions and schema changes are outside this test increment.
No applied migration is changed and no live development data is dumped or restored.

References: PostgreSQL 17 [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html)
(snapshot/custom archive and scope) and [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html)
(transactional restoration and ownership), and [pg_attribute](https://www.postgresql.org/docs/17/catalog-pg-attribute.html)
(dropped attributes remain physical slots).

Candidate run `34496452044`, head `e677f7dd6410dc4eed572b12be2201a36f73e456`,
passed all six jobs and 635 pgTAP assertions. Actual restore compared 1,322 catalog
objects, 72 tables / 3,223 fixture rows, including 23 Auth tables and all 19 migration
rows, plus one archived sequence. Restored isolation/FKs/audit/idempotency and resumed
atomic writes passed. Dump 266 ms; restore 666 ms; whole exercise 2,771 ms for this
fixture only. Temporary target/archive cleanup succeeded.

Three initial failures were retained as failure evidence: empty-target `--clean`
policy drops, insufficient managed-owner privileges, and physical dropped-column
positions. The corrected procedure restores every archived object and retains all
logical schema/data checks. No failed assertion or archive object was excluded.

Final tracked CI, fresh development migration/catalog parity and head-locked merge
are recorded in PR #37. Production PITR and overall Phase 0 remain unverified.
