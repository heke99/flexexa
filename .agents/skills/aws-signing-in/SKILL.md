---
name: aws-signing-in
description: "AWS authentication for local development and automation without long-lived credentials."
priority: critical
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/signing-in-to-aws
---

# aws-signing-in — Flexexa repository skill

## Purpose
AWS authentication for local development and automation without long-lived credentials.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/signing-in-to-aws` when available, then apply this Flexexa overlay.

## Mandatory rules
- Prefer aws login/OIDC/STS temporary credentials.
- Never commit AWS access keys.
- Flexexa CI uses GitHub OIDC roles, not IAM user keys.
- Primary region is eu-north-1 unless master plan changes.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
