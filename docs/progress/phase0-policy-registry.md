# Phase 0 policy registry — candidate, not complete

Scope: master §§10–14. The candidate adds canonical immutable rules, policy versions,
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

Pending verification: isolated migration replay, pgTAP negative/flow tests, real races,
full application/runtime CI, exact applied SQL hash and fresh catalog parity. Do not
apply the candidate or mark this increment complete before these checks pass.

Remaining policy work includes production shadow attestation, additional languages/
domains and scopes, binding administration, production publication/readiness criteria,
Policy Service signing/distribution and application UX. These remain Phase 0 gates
where required by the locked foundation acceptance; table existence does not satisfy them.
