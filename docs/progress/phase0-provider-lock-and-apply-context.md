# Phase 0: provider reproducibility and pre-credential apply guard

Date: 2026-09-16. Status: implementation under verification; no AWS apply or Phase 0 completion.
Baseline: foundation `a22619e1b3c937dbbc92fed7783229e663315353`.
Main already contains the infrastructure-only PR #40 merge
`ce5bdd61c35235a149bd61c74fffcc368a017eee`; aggregate PR #1 remains separate.

## Scope / routing

Locked master-plan sections 71, 73, 77 and 83. Activated:
`flexexa-aws-opentofu`, `aws-iam`, `flexexa-impact-analysis`,
`flexexa-security-review`, `flexexa-affected-verification`.
No SQL, Auth, domain model, provider command or financial behavior changes.
All existing foundation database/runtime/authorization/restore/image gates remain.
Main promotion must copy these exact tested executable files and run its own AWS plan.

## Changes

The development root now tracks the complete provider lock emitted by actual
OIDC plan job `104940373268` / run `35139562524`: signed AWS provider 6.64.0,
constraint `~> 6.62`, including all recorded package hashes. This is persistence
of an observed version, not an untested provider upgrade. Both workflows use
`tofu init -lockfile=readonly` and verify the tracked lock remains unchanged.
The bootstrap-state root is not applied or silently imported by this change.

A separate context guard runs before obtaining AWS credentials and again just
before applying the saved plan. It accepts only manual APPLY_DEV on current main,
checks canonical repository and owner IDs, pins the GitHub API host, rejects
redirects, bounds the request duration, and requires the live branch to report
protected=true. Missing/denied/malformed evidence fails closed. Only a small
sanitized result is printed; HTTP bodies, credentials and upstream errors are not.
Checkout no longer persists its GitHub credential. No workflow token permissions
or AWS trust/permissions are expanded. The original 52-resource saved-plan gate,
state locking, manual-only trigger and zero-drift check remain unchanged.

This protection flag is a necessary minimum, not proof that required reviewers,
required status checks or every ruleset satisfy the complete governance policy.
The guard neither configures protection nor certifies AWS bootstrap readiness.

## Fresh readback / remaining deployment blockers

At 2026-09-16T21:11:37Z, authenticated read-only AWS calls confirmed:
- account 938095765653; root MFA enabled, no root access keys;
- no flexexa-dev-vpc and no ECS clusters in eu-north-1;
- no AWSServiceRoleForECS;
- state bucket versioning enabled, no state-bucket policy;
- actual state prefix flexexa/dev/ empty;
- apply role unchanged, main-only trust and FlexexaFoundationApplyDev policy v1.

GitHub readback reports main protected=false. There are zero workflow_dispatch
runs. Therefore the new guard must reject the current deployment context;
passing synthetic tests does not mean the real environment is approved.
The available connector does not expose initial workflow dispatch or branch
protection writes. No alternate trigger or privilege bypass has been introduced.

Read-only IAM simulation also identified denied state-metadata, ECS service-linked
role and bucket-readback actions. These are diagnostic results, not an actual
failed apply or a claim of complete permission analysis. The state metadata
statement incorrectly couples GetBucketLocation/GetBucketVersioning to an
s3:prefix condition intended for listing. Required provider readbacks and exact
least-privilege remediation remain to be reviewed. AWS permission changes and
administrator access are not performed by this batch.

## Verification

Local Node 22.16.0: all 60 new guard/CLI/workflow-structure tests passed, none
skipped. They cover wrong event/ref/repository/IDs/confirmation, stale commits,
unproven protection, redirects, HTTP failures, malformed JSON and secret-safe errors.
Local full-repository verification was not run: network access for cloning and
installing dependencies is unavailable in this runtime. Full source indexing,
plan coverage, impact analysis, application and specialized verification execute
in the existing foundation CI. Record their exact run/head results in the PR.
The real AWS plan must install from the persisted lock and pass the existing
saved-plan guard before promotion. No database migration was changed.

Hosted services/private connectivity, observability/alerts, credential and
approval lifecycle, hosted recovery/restore and all applicable security/load/E2E
gates remain open. Later phases are not approved by these deployment safeguards.

## Primary references

- https://opentofu.org/docs/language/files/dependency-lock/
- https://opentofu.org/docs/cli/commands/init/
- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using-service-linked-roles-for-clusters.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazon-s3-policy-keys.html
