---
name: aws-sdk-python
description: "boto3/botocore usage for Python services and optimizer-adjacent tooling."
priority: high
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-sdk-python-usage
---

# aws-sdk-python — Flexexa repository skill

## Purpose
boto3/botocore usage for Python services and optimizer-adjacent tooling.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-sdk-python-usage` when available, then apply this Flexexa overlay.

## Mandatory rules
- Use role-based credentials and explicit regions.
- Use paginators/waiters where appropriate.
- Handle ClientError without leaking secrets.
- AWS calls must remain outside deterministic optimization math unless explicitly part of an adapter.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
