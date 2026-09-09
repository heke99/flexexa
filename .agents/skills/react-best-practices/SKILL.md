---
name: react-best-practices
description: "TSX review, hooks, accessibility, performance and React quality."
priority: high
upstream_skill: skills://plugins/vercel/react-best-practices/skill.md
---

# react-best-practices — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/react-best-practices/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

TSX review, hooks, accessibility, performance and React quality.

## Mandatory Flexexa overlay

- Components remain presentation-focused; business rules, authorization and market decisions stay domain/server-side.
- Maintain accessibility and deliberate loading/error/empty states.
- Avoid tenant-specific component forks; use canonical data and brand configuration.
- Never cache authorization or stale critical market state across tenant boundaries for performance.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
