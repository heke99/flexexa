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
  - trust is bound to the exact current GitHub PR OIDC subject:
    `repo:heke99@129280077/flexexa@1362385793:pull_request`
  - AWS managed `ReadOnlyAccess`
  - custom state policy `FlexexaTofuStateReadOnly`
  - no state-write permission; PR plans run with `-lock=false`
- Root MFA verified enabled before bootstrap.
- No IAM users or long-lived access keys were created.

## Bootstrap exception

State storage and the initial GitHub OIDC plan identity are a deliberate chicken-and-egg exception: they must exist before OpenTofu CI can authenticate and use remote state. Normal application infrastructure is managed through OpenTofu.

A separate main-branch apply role will be created only after the actual AWS foundation plan is reviewed and its least-privilege permissions can be derived from concrete resource types.
