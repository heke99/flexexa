# Phase 0: reviewed development readback reconciliation

Date: 2026-09-17. Scope: the AWS first-foundation blocker, not whole Phase 0.

## Observed evidence

Main run `35195030570` at `d5201452a15ebc203a004e845a25075edae47276`
created all 52 reviewed resources with zero updates/deletions. The subsequent
normal plan returned detailed exit code 0, but the strict JSON gate rejected drift.
Read-only diagnostic run `35203776306` observed exactly four projected changes:
`aws_route_table.public.route` and `versioning` on the three storage buckets.

Independent AWS API readback confirmed the active default route to the reviewed
internet gateway and VPC. All three buckets returned versioning Enabled, all four
public-access blocks true, AES256 encryption and BucketOwnerEnforced ownership.
The saved state (serial 1) still had an empty parent route projection and disabled
parent versioning projections. The separately managed route/versioning resources
already contained the applied desired values. No AWS resource or state was
changed by this investigation. No raw state, credentials or full plan JSON is
committed or included in diagnostic output.

## Correction and preserved boundaries

The existing 52-resource manifest and all original rejection tests remain.
A nonempty drift list is accepted only for these four first-read projections,
with exact prior shapes and desired values, no other changed fields, complete
plan/change parity, and independently managed no-op owners. Gateway, VPC,
route-table and bucket identity/region/account relationships are checked.
Unrelated creations, updates, deletes, imports, moves, unknown values, additional
routes, suspended versioning and arbitrary drift are rejected.

The manual protected-main workflow persists a separately saved normal plan only
after detailed exit code 0 and `--require-noop`, then rechecks current protected
main before applying that exact saved plan. This is bounded to one reconciliation,
not an unreviewed refresh or automatic retry loop. The final post-apply gate uses
`--require-converged`, which rejects even these four projections if not persisted.
The read-only PR role cannot perform reconciliation or write state. No IAM,
trust-policy, SQL, schema, RLS, runtime service or production change is included.

Local Node 22.16.0 verification: 57 new projection/CLI/shell regression tests passed.
Pinned full CI, real AWS planning and actual authorized main apply remain required
for their respective acceptance claims. Exact CI/merge evidence is recorded in
PR #48 and its separate main projection; this file does not pre-certify them.

## Skill routing / impact

Activated: flexexa-aws-opentofu, flexexa-impact-analysis,
flexexa-security-review, flexexa-affected-verification. HIGH risk: workflows and
IaC gates; preserve full application and seven-job DB/runtime CI. Plan inventory,
codebase index and affected verification run in the existing quality workflow.
Database/provider/UI implementation is intentionally unchanged.

References: OpenTofu JSON Output Format (resource_drift vs resource_changes),
OpenTofu saved-plan apply, HashiCorp AWS provider aws_route_table and
aws_s3_bucket_versioning documentation. Provider and OpenTofu locks are unchanged.
