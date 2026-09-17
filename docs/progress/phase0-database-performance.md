# Phase 0 — child-FK indexes and statement-cached caller identity

Date: 2026-09-17. Candidate; final CI/live evidence must be recorded in its PR.
Base: foundation `687541ae53e65686db5f562a10abb8a14cf3d78e`.

## Scope and routing

Master-plan sections 18–20, 70–71 and 83: canonical tenant relations, RLS and
PostgreSQL foundation. Activated Supabase/Postgres, codebase index/impact,
affected verification, performance/security/code review and full verification.
No provider, physical control, settlement, new authentication, AWS or UI behavior.
No existing migration is rewritten. The ordinary full seven-job database/runtime
workflow and quality/AWS-plan checks are unchanged.

The source was recovered from CI run 35155529795 artifact 10471600211. Its ZIP
SHA-256 is 522b2ca647e5e249d70d428de410a795109521b88f247d57b24479a6ac48075f;
its complete Git tree is 222086d5164a2c1bc9015d8ab67c85e2a1f1b5c1, exactly the
foundation source tree. Direct clone/dependency installation is not available in
this editor. A temporary branch-only preparation workflow ran the actual pinned
Supabase CLI 2.117.0 (`migration new` after `--help`) in run 35191513963. It generated
the candidate filename, never connected to a database and is removed before review.
It is not an alternate AWS apply trigger. Full application/database tests run in CI.

## Actual baseline and index decisions

Fresh read-only development catalog inspection found 19 recorded migrations,
PostgreSQL 17.6, no Auth users, and small or empty application tables. There is no
credible production latency or throughput improvement to claim from this dataset.
This batch prepares efficient child-FK lookup paths and verifies their structure.

Nineteen B-tree indexes are built; three shorter non-unique indexes are replaced
only after their exact leading-prefix replacements exist. Net addition: 16 indexes.
The manifest lists all keys. Role-first composite indexes cover both UUID-only
references and full tenant/role equality; existing tenant-first membership indexes
are retained. Organization-first event indexes retain existing organization lookup
capability while covering both sides of the composite tenant/organization key.

Do not blindly add an index for the provisioning-completion triple FK: existing
UNIQUE (tenant_id, request_id) bounds a matching lookup to at most one row. Existing
partial indexes with only `FK-column IS NOT NULL` remain valid for FK equality
lookups. Unused-index notices in an empty dev database do not justify deletion.
The advisor may still report the bounded unique-subset case; that is documented
rather than suppressed or padded with a redundant index.

The new PostgreSQL test checks *every* public/private FK, including future additions.
It accepts valid/live/ready default B-tree searchable prefixes, simple implied
null predicates, or a unique FK subset proving a bounded lookup. Wrong leading
keys, INCLUDE-only coverage, unrelated partial/unique predicates and expression
indexes are tested on real temporary PostgreSQL objects and rejected.

## RLS behavior and verification

Only `auth.uid()` becomes `(select auth.uid())` in the two existing membership read
policies. Names, roles, commands and all existing permission/platform OR branches
remain identical. Tenant-dependent permission results are not globally cached.
No grants, row data, FK semantics, tenant IDs or helper functions are changed.
The existing self-metadata read for a revoked membership is preserved; it is not
an active tenant authorization. A separate contract change would be needed to
change that behavior, rather than concealing it in a performance patch.

The new isolated PostgreSQL tests verify own/other-tenant access, permission-based
read expansion, MFA-gated platform access, caller switching between statements,
revocation, missing identity, outsider denial and denied direct writes. Real EXPLAIN
plans must contain statement-level InitPlan evaluation. These are plan/authorization
checks, not a production load benchmark. Existing concurrent RPC, outbox/inbox,
Auth, restore and image tests remain mandatory.

The migration bounds lock waits to 5 seconds and statements to 60 seconds. It is
transactional; larger populated installations must plan online index builds
separately instead of removing those safeguards.

Before foundation merge: pass complete CI; apply exact SQL only to verified dev;
reread server-recorded version/content hash; rename only this candidate and append
the verified ledger entry; rerun full CI and compare fresh live catalog/history.

## Unresolved hosted boundary

Ruleset 23582115 is now active on the default branch with no bypass. Its current
readback still has strict_required_status_checks_policy=false and
required_review_thread_resolution=false, and it requires one approving review.
An author-side connector review is not independent approval. The existing manual
AWS apply has not run. No root/alternate deployment or protection bypass is used.
Database work is independent; it does not certify AWS or complete Phase 0.

## Primary references

- https://www.postgresql.org/docs/17/ddl-constraints.html
- https://www.postgresql.org/docs/17/indexes-multicolumn.html
- https://www.postgresql.org/docs/17/indexes-partial.html
- https://supabase.com/docs/guides/database/postgres/row-level-security
