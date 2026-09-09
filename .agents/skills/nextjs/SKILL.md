---
name: nextjs
description: "Partner portal, admin, developer portal, PWA, App Router and server/client boundaries."
priority: critical
upstream_skill: skills://plugins/vercel/nextjs/skill.md
---

# nextjs — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/nextjs/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Partner portal, admin, developer portal, PWA, App Router and server/client boundaries.

## Mandatory Flexexa overlay

- Next.js owns web surfaces, not authoritative control/dispatch/settlement logic.
- Frontend consumes canonical Flexexa APIs/contracts.
- Tenant routing is not tenant authorization; backend/RLS remains authoritative.
- White-label behavior comes from brand/tenant configuration, not customer-specific forks.
- Follow current installed Next.js documentation for version-specific APIs.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
