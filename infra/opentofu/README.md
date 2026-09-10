# Flexexa AWS/OpenTofu

OpenTofu is the authoritative IaC layer for Flexexa AWS infrastructure.

## Locked decisions
- AWS region: `eu-north-1` (Stockholm)
- OpenTofu: `~> 1.12.0`
- AWS provider: `~> 6.62`
- Remote state: encrypted/versioned S3
- State locking: S3-native lockfile
- CI authentication: GitHub OIDC / temporary STS credentials
- No long-lived AWS access keys in GitHub

## Bootstrap order
1. Authenticate locally with AWS using short-lived credentials.
2. Verify the target AWS account ID.
3. Run `bootstrap-state` once to create the state bucket.
4. Initialize `environments/dev` with partial backend config.
5. Plan and review the dev foundation.
6. Create GitHub OIDC roles with explicit least-privilege policies before CI apply.
7. Apply only after read-back verification.

Do not create ECS, Amazon MQ, Valkey, S3 application buckets, KMS keys or networking manually in the console.


## Current live bootstrap
See `bootstrap/README.md`. PR planning uses no stored AWS keys.
