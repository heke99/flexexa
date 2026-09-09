---
name: aws-database
description: "AWS database/cache service selection, especially ElastiCache/Valkey."
priority: high
upstream_skill: skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-database
---

# aws-database — Flexexa repository skill

## Purpose
AWS database/cache service selection, especially ElastiCache/Valkey.

Load upstream guidance from `skills://plugins/app-6a0b1644959c8191a6ecd016190651cd/aws-database` when available, then apply this Flexexa overlay.

## Mandatory rules
- PostgreSQL/Supabase remains transactional source of truth.
- ClickHouse remains high-volume telemetry store.
- Valkey is hot state/cache/locks, never source of truth.
- Do not introduce a second transactional database without explicit architecture revision.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
