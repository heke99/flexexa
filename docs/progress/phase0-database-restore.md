# Phase 0 logical database restore — candidate

Scope: locked §§70, 77/DoD and Phase 0 database recovery. The isolated CI exercise
uses the running PostgreSQL 17 container's own client binaries, with explicit local
host/port/database and container identity guards. It cannot select a hosted project.
A unique newly created destination is the only database the cleanup may drop.

The source exports a repeatable-read snapshot. The custom-format dump and source
schema/data fingerprints use that exact snapshot, so background Auth maintenance
cannot produce a false mismatch. The archive is restored into a separate database
with ownership/ACLs retained, fail-on-error and a single restore transaction.

Verification compares every application catalog object and ordered SHA-256 row
fingerprints for all public/private/Auth/migration tables and archived sequence values,
then actually exercises
restored RLS, cross-tenant FK rejection, immutable audit, historical idempotency and
new atomic customer/audit/outbox writes. New writes must leave the source untouched.
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
(transactional restoration and ownership). CI replay/restore and final live schema
parity remain pending; no recovery completion is inferred from source inspection.
