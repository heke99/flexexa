---
name: agent-browser-verify
description: "Visual verification after UI/portal changes."
priority: critical
upstream_skill: skills://plugins/vercel/agent-browser-verify/skill.md
---

# agent-browser-verify — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/agent-browser-verify/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Visual verification after UI/portal changes.

## Mandatory Flexexa overlay

- Run after meaningful portal/PWA UI changes.
- Verify tenant and brand context and ensure no cross-tenant data appears.
- Browser success is insufficient when the flow depends on API/database state; pair with verification.
- Check console errors, loading/error/empty states and critical responsive layouts.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
