---
name: vercel-firewall
description: "WAF, rate limits and DDoS/bot protection for public Vercel surfaces."
priority: critical
upstream_skill: skills://plugins/vercel/vercel-firewall/skill.md
---

# vercel-firewall — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/vercel-firewall/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

WAF, rate limits and DDoS/bot protection for public Vercel surfaces.

## Mandatory Flexexa overlay

- Vercel Firewall protects Vercel surfaces and does not replace AWS network/WAF/IAM controls.
- IP or hostname checks are never sufficient tenant authorization.
- Partner/BSP APIs still require application authentication, signatures/mTLS where required and replay protection.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
