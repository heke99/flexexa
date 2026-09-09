---
name: vercel-agent
description: "PR review and incident investigation."
priority: useful
upstream_skill: skills://plugins/vercel/vercel-agent/skill.md
---

# vercel-agent — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/vercel-agent/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

PR review and incident investigation.

## Mandatory Flexexa overlay

- Use as an additional reviewer, not an architecture authority.
- The master prompt, canonical contracts, migrations and executed verification outrank automated suggestions.
- Review specifically for tenant leaks, provider coupling, rule duplication and architecture drift.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
