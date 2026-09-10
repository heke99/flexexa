---
name: flexexa-security-review
description: "Local security review replacing dependency on external Codex Security."
priority: critical
---

# flexexa-security-review — Flexexa repository skill

## Purpose
Local security review replacing dependency on external Codex Security.

This is a Flexexa-native skill and is authoritative for its project-specific scope.

## Mandatory rules
- Scan for secret exposure, tenant escape/BOLA/IDOR, unsafe SECURITY DEFINER, weak IAM, unscoped API keys, replay weaknesses and injection surfaces.
- RLS changes require two-tenant negative tests.
- IAM/IaC changes require least-privilege and trust-policy review.
- Dependency changes require supply-chain review and lockfile verification.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
