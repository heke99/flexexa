---
name: investigation-mode
description: "Systematic debugging when CI, deploy or runtime is broken."
priority: high
upstream_skill: skills://plugins/vercel/investigation-mode/skill.md
---

# investigation-mode — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/investigation-mode/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Systematic debugging when CI, deploy or runtime is broken.

## Mandatory Flexexa overlay

- Diagnose from evidence: runtime/logs, CI/deploy, browser/API, environment/config and database/provider state as applicable.
- Compare the actual deployed commit and schema.
- Treat potential cross-tenant exposure as critical until disproven.
- Do not loop the same failed attempt without changing the hypothesis.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
