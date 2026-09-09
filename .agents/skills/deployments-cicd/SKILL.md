---
name: deployments-cicd
description: "Vercel frontend deployments, previews, promotion and CI/CD."
priority: critical
upstream_skill: skills://plugins/vercel/deployments-cicd/skill.md
---

# deployments-cicd — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/deployments-cicd/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Vercel frontend deployments, previews, promotion and CI/CD.

## Mandatory Flexexa overlay

- Vercel deploys frontend surfaces; critical backend/control services remain on AWS ECS unless the master plan is explicitly revised.
- Production promotion requires required CI and E2E evidence.
- Do not treat a green frontend deployment as proof that backend/control is healthy.
- Verify the exact deployed commit when validating production.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
