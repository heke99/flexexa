---
name: turborepo
description: "Flexexa monorepo, task graph, caching and CI."
priority: critical
upstream_skill: skills://plugins/vercel/turborepo/skill.md
---

# turborepo — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/turborepo/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Flexexa monorepo, task graph, caching and CI.

## Mandatory Flexexa overlay

- Preserve bounded contexts from the master plan.
- Shared canonical contracts live in packages/domain, packages/api-contracts, packages/events and packages/kernel.
- Avoid circular dependencies between apps, services and packages.
- Task caching must never skip correctness/security gates.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
