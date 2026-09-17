---
name: flexexa-docker-local-stack
description: "Local Docker Compose stack for Supabase-adjacent services, RabbitMQ, Valkey, ClickHouse, CitrineOS and simulators."
priority: high
---

# flexexa-docker-local-stack — Flexexa repository skill

## Purpose
Local Docker Compose stack for Supabase-adjacent services, RabbitMQ, Valkey, ClickHouse, CitrineOS and simulators.

## Mandatory rules
- Local containers must mirror production protocols, not production credentials.
- Pin image versions; no latest tags for critical dependencies.
- Persist only data needed for development and provide deterministic reset paths.
- Health checks are mandatory before dependent services start.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill
4. Current vendor/framework documentation

## Completion
Pair this skill with `flexexa-impact-analysis`, `flexexa-security-review` and `flexexa-affected-verification` whenever the change is non-trivial.
