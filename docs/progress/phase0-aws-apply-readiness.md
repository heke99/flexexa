# Phase 0: AWS apply readiness and narrow main promotion

Date: 2026-09-16. Status: **in progress; not an infrastructure deployment or Phase 0 acceptance**.

## Reviewed scope

Locked master-plan sections 71, 73, 77 and 83; Phase 0 AWS/CI/IaC foundation only.
Baseline: `58ffb54783cabba3881b135a4fe251bf2d6976ff` on `phase/0-foundation`.
No SQL migration, canonical model, Auth, provider command, financial or market behavior changes.
All earlier database, tenant-isolation, concurrency, container and runtime gates remain required.

Activated routing: `flexexa-aws-opentofu`, `aws-iam`, `flexexa-impact-analysis`,
`flexexa-security-review`, `flexexa-affected-verification`. UI/provider/settlement skills
are not applicable to this infrastructure-only change. Full application/DB/runtime CI
is retained on the foundation PR; an infrastructure-only extraction to main must match
these tested source files and independently pass its real read-only AWS plan.

## Fresh read-only AWS observations

The connected API authenticated successfully to account `938095765653`. Target region
`eu-north-1` has no ECS clusters and no VPC named `flexexa-dev-vpc`. The development
state prefix is empty. Successful login does not mean application infrastructure exists.

The state bucket has versioning, AES256 encryption and all four public-access blocks
turned on. A bucket policy is absent; TLS-enforcement hardening is still an open item.
The plan and apply OIDC roles exist. Apply trust remains bound to the exact repository
identity and `refs/heads/main`; the plan role retains its existing broad AWS managed
ReadOnlyAccess, which is not certified as final least privilege by this change.
The connected API reports a root principal; it is not used to deploy application resources.
No permanent credentials are created or placed in GitHub.

`AWSServiceRoleForECS` was absent at the fresh read. The first ECS create needs its
normal AWS service-linked identity or a separately reviewed exact bootstrap step.
Do not work around this with AdministratorAccess or wider GitHub trust.

## The circular dependency and its resolution

The manual apply workflow currently exists only in the aggregate foundation branch.
Main contains the original master plan/skills, not the executable infrastructure workflow.
The aggregate Phase 0 PR cannot be called complete before hosted acceptance, while the
apply workflow correctly requires main. Repeated connector login cannot fix this.

Sequence:
1. Verify this safety/CI change against the complete foundation tree.
2. Promote only `infra/opentofu/**` and the two OpenTofu workflows in a separate PR to main.
   Keep the aggregate product PR draft; do not copy incomplete apps or claim Phase 0 done.
3. Run the existing manual `workflow_dispatch` on main with `confirm=APPLY_DEV`.
   No apply-on-push, PR, merge, IAM-trust expansion or root application deployment.
4. Require the saved-plan gate, successful apply, locked zero-drift re-plan and AWS readback.
5. Continue hosted runtime/security/restore acceptance and the remaining foundation gates.

## New fail-closed first-foundation gate

`infra/opentofu/scripts/verify-dev-plan.mjs` reads the actual `tofu show -json` output.
It restricts the account, region, project, environment, repository, selected AZs and exact
52 managed resource addresses. It permits only create/no-op for this first foundation,
rejecting update/delete/replacement/import/move, unexpected resources/providers,
missing or duplicate evidence, incomplete/deferred/error plans and unresolved checks.
Critical settings are checked in both planned values and changes: private addressing,
immutable/scanned ECR, versioned/encrypted/nonpublic S3, ownership and log retention.
It emits a small non-secret summary, not state or plan JSON. This is not a replacement
for HCL/IAM review, final least privilege, drift remediation or future service approvals.
Any expansion or legitimate update needs a separately reviewed gate/manifest change.

The provider also rejects other account IDs and the dev root rejects other scope values.
PR plans stay read-only (`-lock=false`); apply and post-apply verification acquire the
state lock. Only the validated saved plan is applied. Full plan JSON is temporary and
is never uploaded as a workflow artifact. A green unit fixture is not AWS evidence.

## Verification record

Local Node.js 22.16.0: 70 plan-gate tests passed; synthetic valid/invalid plan inputs.
Remote real AWS plan, full foundation CI, main promotion, apply and live runtime
acceptance must be recorded with exact commit/run IDs before being called complete.
The original 19 migrations/1,322-object parity evidence remains historical until a fresh
readback; no new database modification is required for this batch.

## Remaining Phase 0 gates

Hosted AWS service deployments/private connectivity, observability dashboards/alerts,
credential and approval/break-glass lifecycle, production policy/binding/signing criteria,
hosted outbox/inbox recovery, provider lifecycle boundaries, and applicable restore,
security, load and end-to-end acceptance remain open. Phases 1–13 are not implemented
or approved by this infrastructure promotion.
