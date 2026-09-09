---
name: aws-observability
description: "CloudWatch, ADOT/OpenTelemetry, X-Ray and CloudTrail."
priority: high
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-observability
---

# aws-observability — Flexexa repository skill

## Purpose
CloudWatch, ADOT/OpenTelemetry, X-Ray and CloudTrail.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-observability` when available, then apply this Flexexa overlay.

## Mandatory rules
- Propagate correlation_id and causation_id end-to-end.
- Combine AWS telemetry with Flexexa OpenTelemetry conventions.
- CloudTrail is required for infrastructure/admin auditability.
- PII and secrets must be redacted.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
