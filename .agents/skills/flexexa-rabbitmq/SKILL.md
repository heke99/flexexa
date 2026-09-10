---
name: flexexa-rabbitmq
description: "RabbitMQ topology, event contracts, retries, DLQs and consumer idempotency."
priority: critical
---

# flexexa-rabbitmq — Flexexa repository skill

## Purpose
RabbitMQ topology, event contracts, retries, DLQs and consumer idempotency.

## Mandatory rules
- RabbitMQ is the core async bus.
- Every message uses the canonical event envelope with event version, tenant, correlation and causation IDs.
- Consumers are idempotent and retry policies are bounded with DLQ handling.
- Do not use the broker as durable business-state storage.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill
4. Current vendor/framework documentation

## Completion
Pair this skill with `flexexa-impact-analysis`, `flexexa-security-review` and `flexexa-affected-verification` whenever the change is non-trivial.
