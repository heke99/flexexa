# Delivery acceptance plan change — 2026-09-18

Scope: versioned plan addendum, recorded-evidence integrity and continuation guidance.
No device commands, market writes, payouts, database/IAM/workflow/dependency changes.
No requirement or phase is marked implemented, verified or production-ready.

The locked V1 file and its baseline coverage register are unchanged. The addendum
maps ten requirements and 31 explicit acceptance cases to existing V1 sections and
phases; the new coverage register starts entirely planned with no evidence.
The masterplan report now checks both sources and combines their recorded readiness.
Missing cases, stale/absent evidence, wrong evidence kind, dependency violations and
non-success checks fail closed. Static checks still cannot authenticate real tests or
external approvals; actual run/artifact/hardware/partner review remains mandatory.

Target: the existing authoritative implementation branch `phase/0-foundation`, not
a premature merge of the entire foundation into `main`. Preserve the separately
reviewed main web/infrastructure projection and its still-open operational gates.

Activated local skills: verification, flexexa-test-strategy, flexexa-codebase-index,
flexexa-impact-analysis, flexexa-code-review and flexexa-security-review.
Conditional: browser/DB/cloud-specific verification remains for implementation work.
Intentionally not performed by this change: live DB migrations, AWS apply, provider
control, real market integration and commercial/qualification approval.

Direct impact: AGENTS continuation, the existing plan:check/plan:ready CLI, its report,
and quality tests. Existing CI invokes plan:check, codebase index, impact analysis and
verify:affected; the quality-test glob discovers the new regression suite. No existing
gate or workflow is removed or weakened. The new normative document participates in
the existing implementation digest; coverage evidence stays outside that digest.

Local isolated verification: 28 new validator regression tests passed on Node 22.16.0;
syntax checks passed. These results are not a full workspace/Node-24/CI result. Remote
ordinary CI on the published candidate and review must still be checked before merge.
The complete repository could not be cloned in the local runtime because GitHub DNS
was unavailable; connected GitHub reads/writes remain usable. No local full-runtime
verification or live-schema parity is claimed.

Acceptance of this PR means the plan and its integrity checks are delivered. It does
not accept the 31 specified product/hardware/operational/partner cases. Evidence for
those cases must be collected during the corresponding implementation phases.

## Review remediation — 2026-10-02

Both CodeRabbit findings on head `88c8122a2665e79b61b4bacac0b44e176e03c7b0`
were checked against the actual code and confirmed. Linked evidence now requires
the current implementation digest for planned, partial and blocked requirements as
well as verified requirements. Two regression tests cover rejection across all three
incomplete statuses and acceptance of current evidence without approving delivery.
The stale-evidence regression failed before the fix and passed afterwards.
AGENTS explicitly separates offline metadata checks from independent review or
verifiable provenance; simulators remain prohibited as substitutes for real evidence.

The repository clone is now available locally. Frozen installation with pnpm 12.3.4
passed on Node 24.19.0. The existing verify:affected application-only route passed
quality regressions, workspace lint, typecheck, tests and production build. The
delivery suite contains 30 tests. Its child pnpm tasks used the runtime's pnpm
11.25.0; ordinary CI must still verify the final published candidate with the pinned
12.3.4 toolchain. Index/impact review remains HIGH with application and masterplan
source/evidence review required. Twenty PostgreSQL migrations and both ClickHouse
migrations retain exact historical bytes; no live schema readback is claimed.
The unchanged V1 catalogue retains 88 sections, 14 phases and 3,701 source points.
All ten FXP requirements remain planned, with no product evidence; plan readiness
remains false. No AWS apply, device/market action or payout was performed.

Activated: codebase-index, impact-analysis, affected-verification, code-review,
security-review, test-strategy and verification (including its upstream guidance).
Story: normative catalogue -> evidence ledger -> validator -> plan CLI readiness;
its direct report/test consumers and CI invocation were reviewed. Database, browser,
provider and cloud mutations are intentionally outside this remediation's scope.
Final-head CI and review remain mandatory before merge; prior-head green checks
are not evidence for the corrected candidate.
