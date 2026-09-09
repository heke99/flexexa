---
name: routing-middleware
description: "Hostname/tenant routing, custom domains and selected access flows."
priority: useful
upstream_skill: skills://plugins/vercel/routing-middleware/skill.md
---

# routing-middleware — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/routing-middleware/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Hostname/tenant routing, custom domains and selected access flows.

## Mandatory Flexexa overlay

- Use for routing and tenant/brand context resolution, not final authorization.
- Hostname, slug and middleware state are never sufficient proof of tenant access.
- Authorize again server-side/RLS against canonical tenant ownership.
- Do not place control-plane or BSP security decisions in frontend routing middleware.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
