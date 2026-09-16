# Phase 0 — bounded AWS bootstrap remediation

Date: 2026-09-16. Baseline: `ed672792b8a0afcd53df1d71371e319681c6c570`.
Status: candidate verified structurally and by AWS policy simulation; full CI and live bootstrap readback still required.

## Scope and routing

Master-plan sections 71, 73, 77 and 83. Activated: flexexa-aws-opentofu,
aws-iam, flexexa-security-review, flexexa-impact-analysis and
flexexa-affected-verification. No application, SQL migration, authorization
contract, physical command or market/financial operation changes.
Existing full quality/index/impact/database/runtime/restore/image CI remains.
No local full-repository run is claimed: this execution environment cannot resolve
GitHub for cloning or dependency installation. New standalone tests execute locally.

## Exact reviewed configuration

`infra/opentofu/bootstrap/apply-policy-v1-observed.json` is the complete observed
FlexexaFoundationApplyDev v1, not a new desired policy. v2 makes these bounded changes:

- Separate state metadata reads from prefix-constrained ListBucket.
- Limit state GetObject/GetObjectVersion/PutObject to the exact default-workspace
  `flexexa/dev/foundation.tfstate`; DeleteObject is limited to its `.tflock`.
- Add ten bucket-configuration read operations for only the three dev buckets.
- Restrict ECS to the exact dev cluster, ECR to the dev path, and log changes to
  `/flexexa/dev/*`; keep regional DescribeLogGroups separately read-only.
- Add no IAM, role-passing, STS, secret-read or new mutation action.

The existing region-wide EC2 permissions remain unchanged and are NOT certified
as final least privilege. The plan role's existing AWS managed ReadOnlyAccess
also remains a separate hardening item. This batch does not make hosted runtime ready.

The state TLS policy is denial-only, covering the bucket and all its objects.
It denies insecure non-service requests and preserves AWS service-principal
compatibility as documented by AWS. It grants no public access.

`bootstrap-state/security.tf` records the corresponding TLS policy and the normal
AWS-managed ECS service-linked role. This bootstrap root is NOT the live dev state.
Do not blindly apply it: the existing state bucket and any bootstrapped security
objects must first be imported and reviewed in a separately protected bootstrap state.
Normal application resources remain managed exclusively through the dev OpenTofu root.

## Evidence before change

AWS readback at 2026-09-16T21:35:49Z: no dev VPC/ECS, no ECS service-linked role,
no state bucket policy; root MFA enabled with no root access keys. Apply trust is
unchanged and bound to main. The observed policy is v1 and has one attachment.

Local Node 22.16.0: 24 structural regression tests passed, zero skipped.
At 2026-09-16T21:40:31Z, AWS Access Analyzer returned zero findings for both the
candidate identity policy and TLS resource policy. All 48 IAM action evaluations
across 18 scenarios matched the intended allow/deny decisions. These are actual
AWS policy simulations, not actual network calls made as the deployment role.
The API script compared the full live v1 document before deriving the candidate.

Canonical JSON SHA-256, object keys sorted, array order retained:
- observed v1: c7c8da7f68341fc7ac406c24a3021b752d338ebe6ea977e79d38446e11c83c15
- candidate v2: c7946a031404a09ff982fcd1a7653c3243e599091c18077f5c1b4a7d6f685a4b
- state TLS: 4fd9ab6a65d4406ff244ded58ff36d2826afa3c2320c1a743e922daf6f0ecec7

## Controlled completion sequence

1. Require complete foundation CI plus the unchanged real 52-resource dev plan.
2. Read back this exact published candidate and current bootstrap objects.
3. Under the already authorized one-time bootstrap exception, create only the
   normal ECS service-linked identity and set the reviewed denial-only state policy.
4. Replace the attached apply policy via a new version only if the complete v1,
   sole attachment, trust and absence of inline policies still match the review.
   Retain old v1 for audit/controlled rollback; do not expand trust or create keys.
5. Independently re-read policies, trust, MFA, state controls and the ECS role;
   rerun the permission scenarios on the actual attached role.
6. Record actual CI IDs and live results in the PR, then promote identical source
   configuration to main through its own independently verified infrastructure PR.

No automatic apply trigger is added. The manual main-only protected-branch check,
provider lock, saved-plan resource guard, state locking and zero-drift requirement
are unchanged. Branch administration and initial workflow dispatch are not exposed
by the connected GitHub tool. No workaround may bypass these restrictions.

Whole Phase 0 remains open until hosted services/private connectivity, observability
and alarms, authorization/credential/approval lifecycle, required restore/security/
load and end-to-end acceptance pass. The database index/RLS performance findings
from the independent advisor review are separate follow-up work.

## Primary references

- https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using-service-linked-roles-for-clusters.html
- https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazon-s3-policy-keys.html
- https://docs.aws.amazon.com/IAM/latest/APIReference/API_CreatePolicyVersion.html
- https://opentofu.org/docs/language/settings/backends/s3/
