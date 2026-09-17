---
name: flexexa-affected-verification
description: "Route verification based on deterministic change impact."
priority: critical
---

# flexexa-affected-verification — Flexexa repository skill

## Purpose
Route verification based on deterministic change impact.

This is a Flexexa-native skill and is authoritative for its project-specific scope.

## Mandatory rules
- Run pnpm verify:affected -- --base <base-ref>.
- LOW/MEDIUM changes use Turborepo --affected plus domain-specific checks.
- HIGH changes require full typecheck/test/build plus specialized security/DB/concurrency/contract checks when relevant.
- Never reduce a HIGH-risk change to affected-only verification.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
