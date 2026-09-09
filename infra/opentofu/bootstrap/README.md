# AWS bootstrap record

This directory documents the one-time bootstrap required before normal OpenTofu remote-state workflows can run.

## Live bootstrap — 2026-09-09

AWS account: `938095765653`  
Primary region: `eu-north-1`

Created and read-back verified:

- S3 state bucket: `flexexa-tofu-state-938095765653`
  - versioning enabled
  - SSE-S3/AES256 encryption
  - all public access blocked
  - BucketOwnerEnforced ownership
- GitHub OIDC provider: `token.actions.githubusercontent.com`
  - audience: `sts.amazonaws.com`
- PR plan role: `arn:aws:iam::938095765653:role/flexexa-github-plan`
  - trust limited to `repo:heke99/flexexa:*`; the role itself is read-only and has no state-write permission
  - AWS managed `ReadOnlyAccess`
  - custom state policy `FlexexaTofuStateReadOnly`
- Root MFA verified enabled before bootstrap.
- No IAM users or long-lived access keys were created.

## Security boundary

The plan role is intentionally unable to apply infrastructure. PR plans run with `-lock=false` so the role does not need write access to the remote state bucket.

A separate main-branch apply role will be created only after the actual AWS foundation modules and their least-privilege permission set are reviewed.

These bootstrap objects are a deliberate chicken-and-egg exception because the remote-state/OIDC path must exist before OpenTofu CI can authenticate. Normal application infrastructure must be managed through OpenTofu.
