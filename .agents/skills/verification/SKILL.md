---
name: verification
description: "Full-story E2E verification: browser to API to data to response."
priority: critical
upstream_skill: skills://plugins/vercel/verification/skill.md
---

# verification — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/verification/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

Full-story E2E verification: browser to API to data to response.

## Mandatory Flexexa overlay

- Verify the whole flow, not only UI rendering.
- Tenant-sensitive work requires positive and negative two-tenant tests.
- Database changes require clean migration replay.
- Flex reservations require concurrency/oversubscription tests.
- Settlement/ledger changes require idempotency and debit=credit tests.
- No phase is complete until the relevant master-plan Definition of Done is green.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
