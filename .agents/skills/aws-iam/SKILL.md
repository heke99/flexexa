---
name: aws-iam
description: "IAM roles, trust policies, least privilege and service identities."
priority: critical
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-iam
---

# aws-iam — Flexexa repository skill

## Purpose
IAM roles, trust policies, least privilege and service identities.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-iam` when available, then apply this Flexexa overlay.

## Mandatory rules
- GitHub Actions authenticates through OIDC.
- Use separate execution/task/deploy roles with least privilege.
- Production-access roles require explicit scope and auditability.
- Do not map AWS IAM to Flexexa tenant RBAC; they are different authorization layers.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
