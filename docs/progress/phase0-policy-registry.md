# Phase 0 policy registry — verified sandbox increment

Scope: master §§10–14. This increment adds canonical immutable rules, policy versions,
tests, tenant bindings/readiness and evaluation tables. Bounded power rules accept
numeric limits and reason codes, never SQL, JavaScript or an LLM expression. Limits
and requests are 0–1,000,000 kW with at most six decimal places; this bounded
comparison language avoids arbitrary-precision JSON values diverging from JS numbers.

The checked sandbox workflow creates drafts, executes supplied expected test cases,
records simulated shadow observations, requires a different current MFA platform
administrator to approve, then publishes atomically with tenant audit/outbox evidence.
New publication supersedes old readiness and creates a pending row for each target.
Evaluation deliberately retains `SANDBOX_ONLY` as a blocker. Simulated observations
are not production shadow evidence, control permission or a signed snapshot.

Skill routing: Supabase/Postgres, verification, index/impact/affected verification,
code/security/performance review and test strategy are active. Deployment CI applies
to the replay gate. Browser, provider and AWS skills are conditional on those surfaces;
this change does not operate devices or provision infrastructure.

Security model: global registry reads/writes require live Auth user/session, MFA and
active platform role; authorization is locked and rechecked after waits. Direct table
writes are denied to authenticated and service_role. Published content, child membership
and stored test observations are immutable. Parent locks serialize authoring and
publication. Idempotency replay rechecks current authorization.

Canonical audit/receipt scope: the existing evidence tables gain explicit `scope_type`,
following the existing global/tenant role model. All tenant evidence still requires a
real tenant through a check constraint and existing composite FKs. Global human actions
use platform scope with null tenant; no synthetic tenant and no duplicate audit store.
A scope FK prevents platform audit from borrowing tenant receipts. Tenant RLS cannot
read global evidence. This is not permission to make tenant business rows ownerless.

Candidate run `34488450642` passed all six application/database/runtime jobs: 606
pgTAP assertions, 16 simultaneous creates, 16 simultaneous publications, 12 persisted
SQL/Kernel comparison cases, unrelated-tenant publication currency and session expiry
after a real lock wait. All previous Auth/container/outbox checks remain green.

Development migration `20260910142645` was applied from exactly that tested SQL:
49,150 bytes, SHA-256 `9ef425da9994645678b7c8292f090b88e4852d7f06cacd993a4644ac1ba350a1`.
All 18 migration entries and 1,284 application catalog objects match; no schema differences.
The final filename/pin commit must also pass CI; final tracked run and merge evidence
are recorded in PR #35. No Phase 0 completion or production policy readiness is claimed.

Review: no new dependencies, CI credentials or permissions. Workflow change adds only
the isolated concurrency/Kernel check. Inputs and fanout are bounded; parent/definition
locks serialize changes and indexed FK/read paths preserve scope. The initial failed
run exposed denied readiness reads: explicit live platform reads and fixture-only
`rules.read` grants fixed it without expanding tenant role templates.

Remaining policy work includes production shadow attestation, additional languages/
domains and scopes, binding administration, production publication/readiness criteria,
Policy Service signing/distribution and application UX. These remain Phase 0 gates
where required by the locked foundation acceptance; table existence does not satisfy them.
