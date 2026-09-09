---
name: vercel-api
description: "Read/manage Vercel projects, domains, deployments and logs."
priority: high
upstream_skill: skills://plugins/vercel/vercel-api/skill.md
---

# vercel-api — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/vercel-api/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Read/manage Vercel projects, domains, deployments and logs.

## Mandatory Flexexa overlay

- Use only for Vercel platform state and operations.
- Do not treat Vercel configuration as authority for AWS ECS/control-plane infrastructure.
- Verify exact deployed commits for production checks.
- Domain operations must preserve tenant/brand verification and canonical routing rules.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
