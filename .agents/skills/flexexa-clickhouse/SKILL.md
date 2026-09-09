---
name: flexexa-clickhouse
description: "ClickHouse telemetry schema, ingestion, retention and query patterns."
priority: high
---

# flexexa-clickhouse — Flexexa repository skill

## Purpose
ClickHouse telemetry schema, ingestion, retention and query patterns.

## Mandatory rules
- High-volume telemetry belongs in ClickHouse, not transactional Postgres.
- Use explicit units/timezone/canonical asset identifiers and tenant attribution.
- Partition/order keys follow actual query patterns; avoid unbounded high-cardinality indexes.
- Raw telemetry retention and aggregated retention are explicit and versioned.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill
4. Current vendor/framework documentation

## Completion
Pair this skill with `flexexa-impact-analysis`, `flexexa-security-review` and `flexexa-affected-verification` whenever the change is non-trivial.
