---
name: shadcn
description: "UI foundation and consistent white-label design system."
priority: high
upstream_skill: skills://plugins/vercel/shadcn/skill.md
---

# shadcn — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/shadcn/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

UI foundation and consistent white-label design system.

## Mandatory Flexexa overlay

- Use source-owned shadcn components as the UI foundation.
- Build reusable brandable primitives for admin, partner and consumer surfaces.
- Do not place business rules or authorization in UI components.
- Operational UI must clearly distinguish physical availability, safe availability, commitments, dispatch, settlement and incidents.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
