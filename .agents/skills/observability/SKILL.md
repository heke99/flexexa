---
name: observability
description: "OpenTelemetry, logs, traces, metrics and frontend/backend diagnostics."
priority: critical
upstream_skill: skills://plugins/vercel/observability/skill.md
---

# observability — Flexexa repository skill

Use this repo-local skill whenever the task matches its scope.

When the ChatGPT/plugin upstream skill is available, load **skills://plugins/vercel/observability/skill.md** as the framework/provider authority, then apply this Flexexa overlay.

## Flexexa purpose

OpenTelemetry, logs, traces, metrics and frontend/backend diagnostics.

## Mandatory Flexexa overlay

- Vercel observability covers Vercel surfaces; AWS ECS/control-plane flows must also emit OpenTelemetry.
- Propagate correlation_id and causation_id across HTTP, events, commands, BSP messages and settlement.
- Track mobility SLA, telemetry lag, command latency/success, flex MW and unmatched settlement.
- Never log secrets or unnecessary PII.

## Repository authority

1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Current schema, migrations, canonical contracts and executed tests
3. This repository skill and its upstream skill
4. Current official framework/provider documentation

If generic upstream guidance would silently change the locked Flexexa architecture, do not make that architecture change. Follow the versioned master plan until it is explicitly revised.

## Completion

Do not report completion from code inspection alone. Run the relevant tests/builds/verification for the changed surface and preserve tenant isolation, canonical boundaries, auditability and idempotency.
