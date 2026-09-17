---
name: flexexa-performance-review
description: "Performance review across Postgres, ClickHouse, APIs, React and AWS without weakening correctness."
priority: high
---

# flexexa-performance-review — Flexexa repository skill

## Purpose
Performance review across Postgres, ClickHouse, APIs, React and AWS without weakening correctness.

## Mandatory rules
- Measure before optimizing.
- Database review must include query shape, indexes, locking and cardinality.
- Telemetry paths must protect ClickHouse from unbounded cardinality and tiny writes.
- Never trade tenant isolation, financial correctness or control safety for latency.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill
4. Current vendor/framework documentation

## Completion
Pair this skill with `flexexa-impact-analysis`, `flexexa-security-review` and `flexexa-affected-verification` whenever the change is non-trivial.
