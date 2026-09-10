---
name: aws-sdk-js
description: "AWS SDK for JavaScript v3 usage."
priority: high
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-sdk-js-v3-usage
---

# aws-sdk-js — Flexexa repository skill

## Purpose
AWS SDK for JavaScript v3 usage.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-sdk-js-v3-usage` when available, then apply this Flexexa overlay.

## Mandatory rules
- Use modular @aws-sdk/* packages.
- Credentials come from the standard runtime chain/OIDC roles.
- Use retries/timeouts intentionally and preserve correlation IDs.
- Never log request credentials or sensitive response payloads.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
