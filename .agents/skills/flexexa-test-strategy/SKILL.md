---
name: flexexa-test-strategy
description: "Risk-based test strategy for unit, integration, property, concurrency, replay and E2E tests."
priority: critical
---

# flexexa-test-strategy — Flexexa repository skill

## Purpose
Risk-based test strategy for unit, integration, property, concurrency, replay and E2E tests.

This is a Flexexa-native skill and is authoritative for its project-specific scope.

## Mandatory rules
- Write tests around invariants, not only happy paths.
- Reservations require concurrency/no-oversubscription tests.
- Settlement/ledger requires idempotency, duplicate and balance invariants.
- Canonical/event/API changes require compatibility/consumer tests.
- Tenant-sensitive features require negative cross-tenant tests.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
