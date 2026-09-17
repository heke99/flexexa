---
name: aws-containers
description: "ECS/Fargate/ECR deployment and operations."
priority: critical
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-containers
---

# aws-containers — Flexexa repository skill

## Purpose
ECS/Fargate/ECR deployment and operations.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-containers` when available, then apply this Flexexa overlay.

## Mandatory rules
- Critical backend/control services remain ECS/Fargate.
- Use private networking for non-public services.
- Secrets are injected from approved secret stores, not baked into images.
- Health checks, graceful shutdown and rollback are mandatory.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
