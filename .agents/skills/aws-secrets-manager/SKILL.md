---
name: aws-secrets-manager
description: "Secret handling and AWS Secrets Manager safety."
priority: critical
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-secrets-manager
---

# aws-secrets-manager — Flexexa repository skill

## Purpose
Secret handling and AWS Secrets Manager safety.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-secrets-manager` when available, then apply this Flexexa overlay.

## Mandatory rules
- Never retrieve secret plaintext into agent context when avoidable.
- Use runtime references/injection.
- No secrets in Git, Docker images, public env vars or logs.
- Rotate provider/BSP/OEM credentials independently.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
