# Phase 0 — child-FK indexes and statement-cached caller identity

Date: 2026-09-17. Development applied and read back; final tracked-version CI/merge evidence is recorded in PR #47.
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
The advisor can still report reordered composite equality keys and the bounded
unique-subset case; these must be assessed against actual indexes, not hidden or
padded with redundant indexes merely to remove advisory notices.

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

Before foundation merge: final tracked-version CI, fresh history/catalog comparison
and exact-head review must still pass. Applied SQL is now immutable.

## Actual development deployment and evidence

Source candidate `bfa4242f6d2c4723bf8143ec2d505a561cbbed5d` passed quality
`35192256800`, actual AWS plan `35192256772` and all seven database/runtime jobs
in `35192256858`. Real PostgreSQL tests: 869 passing assertions across 17 files,
including 234 new catalog/index/adversarial/RLS/EXPLAIN assertions. All 179 current
public/private FKs passed the coverage classifier. Logical restore verified 1,338
application catalog objects, 72 tables (23 Auth), 20 replayed migration rows and
26 restoration assertions. Existing real Auth, concurrent RPC, RabbitMQ and
Collector crash-recovery tests and image scans remained enabled and passed.

The first apply attempt was blocked by the tool safety-status check, whose error
explicitly advised retrying later. At 07:07:01Z the complete application catalog
and 19 migration rows were still unchanged. One later retry used the same
`apply_migration` endpoint and exactly the same SQL, without another route,
splitting statements or changing any safety controls; it succeeded.

Server-recorded migration version: **20260917070939**. The CLI-generated candidate
filename alone was renamed to match it. SQL: 3,398 bytes, SHA-256
`5e500ab698f1243825f31facbbce1f422c21f87b46d972ce73c9e6e4c0bbbca2`.
The 07:09:56Z live readback confirmed the exact name, length and hash, all prior
19 recorded versions, new indexes present and the superseded prefix removed.
The applied ledger appends only this version; all historical exceptions remain
unchanged. No local guess or normalization is used for the server version.

Full catalog comparison uses the existing canonical catalog query: sort every
(kind,key) by C/UTF-8 order, hash the LF-joined kind<TAB>key<TAB>object-hash list
without a trailing LF, and also verify object/unique-key counts. Baseline clean
replay and fresh pre-apply dev both had 1,322 objects and root
`9f23ff0bdf37bf16383dea881c82a0fb3bac145d732b4e850ea88f6a896f3b77`.
The complete candidate clean artifact (10484153376) has 1,338 unique objects and
root `427ec9ca4fb3d5fe9fc7abcd095bac4bceb8c73692a0d31c7ecf1c49cc892265`.
Fresh live readback at 07:10:48Z has that same complete root and count. This is
comparison of the entire object-hash map, not only counts or selected tables.
Full baseline/candidate comparison found exactly 19 added indexes, three removed
prefix indexes and two changed policies; no other catalog objects differ.
Final tracked-version CI must independently reproduce this catalog.

Post-apply advisors: both auth_rls_initplan warnings are gone. Security findings
remain the same 12 informational default-deny/no-policy notices, no WARN/ERROR.
The performance advisor still reports five FK INFO notices: four use reversed
composite equality key order (inbox_events, outbox_events, membership_roles and
role_permissions); provisioning completions uses the unique tenant/request
subset bounding its triple FK lookup. The exhaustive catalog/negative tests
verify these access paths. The notices are not suppressed. Existing audit-policy
composition and Auth-connection-strategy notices are separate follow-up work;
unused-index notices are expected in this small dev catalog and are not a reason
to delete otherwise useful indexes. No production speedup is claimed.

Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

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
