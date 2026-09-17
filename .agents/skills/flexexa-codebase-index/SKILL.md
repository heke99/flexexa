---
name: flexexa-codebase-index
description: "Deterministic repository indexing across code, packages, SQL, events, APIs, environment usage, infrastructure and tests."
priority: critical
---

# flexexa-codebase-index — Flexexa repository skill

## Purpose
Deterministic repository indexing across code, packages, SQL, events, APIs, environment usage, infrastructure and tests.

This is a Flexexa-native skill and is authoritative for its project-specific scope.

## Mandatory rules
- Run pnpm index:codebase before non-trivial impact analysis.
- Generated index is evidence, not authorization.
- Index TypeScript imports, package dependencies, SQL objects/references, env usage, event occurrences, API surfaces, infrastructure resources and tests.
- Do not commit generated index JSON unless a workflow explicitly requires a snapshot.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
