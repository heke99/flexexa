---
name: supabase
description: "Auth, Postgres, migrations, RLS, RPC, Supabase configuration and security controls."
priority: critical
upstream_skill: skills://plugins/supabase/supabase/skill.md
---

# supabase — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/supabase/supabase/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Auth, Postgres, migrations, RLS, RPC, Supabase configuration and security controls.

## Mandatory Flexexa overlay

- Every tenant-owned row has tenant_id NOT NULL.
- Enforce same-tenant ownership with database constraints, not only application checks.
- All exposed tenant tables require RLS and permission-based authorization.
- Critical multi-row writes use transactional RPC/application-service boundaries.
- Never expose service_role to frontend.
- SECURITY DEFINER is exceptional: fixed search_path, explicit grants, caller validation and tests.
- Every schema change must pass clean migration replay, RLS tests and two-tenant negative tests.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
