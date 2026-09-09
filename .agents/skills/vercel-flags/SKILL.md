---
name: vercel-flags
description: "UI/product feature rollout only; never the central Flexexa Rules Engine."
priority: selective
upstream_skill: skills://plugins/vercel/vercel-flags/skill.md
---

# vercel-flags — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/vercel-flags/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

UI/product feature rollout only; never the central Flexexa Rules Engine.

## Mandatory Flexexa overlay

- Use only for UI/product rollout, experiments and non-authoritative feature exposure.
- Never use Vercel Flags for market eligibility, safe capacity, bidding, dispatch, tariff/tax, BRP/BSP rules, settlement, revenue allocation, retention or physical safety.
- Authoritative dynamic rules belong in the versioned Flexexa Kernel / Policy & Rules Layer.
- Feature flags and business rules are separate concepts.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
