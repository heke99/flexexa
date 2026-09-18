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
