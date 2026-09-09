---
name: bootstrap
description: "Safe initial repo, Vercel and environment bootstrap."
priority: high-initial
upstream_skill: skills://plugins/vercel/bootstrap/skill.md
---

# bootstrap — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/bootstrap/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Safe initial repo, Vercel and environment bootstrap.

## Mandatory Flexexa overlay

- Preserve the locked split: Vercel frontend, AWS critical backend/control, Supabase/Postgres transactions, ClickHouse telemetry, RabbitMQ events, Valkey hot state and S3 raw/archive.
- Do not replace the locked AWS/RabbitMQ/Valkey architecture with convenient Vercel alternatives.
- Establish canonical packages, migrations, tenant/RBAC/RLS, CI and observability before product shortcuts.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
