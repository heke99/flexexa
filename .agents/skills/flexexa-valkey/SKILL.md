---
name: flexexa-valkey
description: "Valkey hot-state, locks, cache, rate-limit and presence patterns."
priority: high
---

# flexexa-valkey — Flexexa repository skill

## Purpose
Valkey hot-state, locks, cache, rate-limit and presence patterns.

## Mandatory rules
- Valkey is never source of truth.
- All keys are environment/tenant/resource scoped where applicable.
- Distributed locks have ownership tokens and expiry; unsafe unlocks are forbidden.
- Critical cached policy snapshots are versioned, signed/validated where required and have safe-expiry behavior.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill
4. Current vendor/framework documentation

## Completion
Pair this skill with `flexexa-impact-analysis`, `flexexa-security-review` and `flexexa-affected-verification` whenever the change is non-trivial.
