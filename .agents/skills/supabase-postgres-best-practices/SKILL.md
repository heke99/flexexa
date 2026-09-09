---
name: supabase-postgres-best-practices
description: "Schema, indexes, query performance, locking, concurrency, RLS and PostgreSQL design."
priority: critical
upstream_skill: skills://plugins/supabase/supabase-postgres-best-practices/skill.md
---

# supabase-postgres-best-practices — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/supabase/supabase-postgres-best-practices/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Schema, indexes, query performance, locking, concurrency, RLS and PostgreSQL design.

## Mandatory Flexexa overlay

- Correctness and tenant isolation come before performance.
- Design indexes around actual tenant-scoped query patterns.
- Test locks/concurrency for flex reservations, commitments, settlement imports and ledger posting.
- Flex capacity oversubscription must remain impossible under concurrent transactions.
- Settlement-grade money, power and energy use exact numeric/decimal types.
- Preserve forward-only production migration discipline and clean replay.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
