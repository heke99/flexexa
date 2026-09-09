---
name: env-vars
description: "Secrets and environment configuration without credential leakage."
priority: critical
upstream_skill: skills://plugins/vercel/env-vars/skill.md
---

# env-vars — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/env-vars/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Secrets and environment configuration without credential leakage.

## Mandatory Flexexa overlay

- Never expose BSP, OEM, Supabase service-role or signing secrets through NEXT_PUBLIC variables.
- Production secret material belongs in approved secret stores such as AWS Secrets Manager/KMS.
- Repository and database store secret references, not raw credentials.
- Environment changes must be explicit and environment-scoped.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
