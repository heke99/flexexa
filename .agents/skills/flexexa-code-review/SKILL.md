---
name: flexexa-code-review
description: "Repository-wide differential code review using the impact report as required context."
priority: critical
---

# flexexa-code-review — Flexexa repository skill

## Purpose
Repository-wide differential code review using the impact report as required context.

This is a Flexexa-native skill and is authoritative for its project-specific scope.

## Mandatory rules
- Review the diff and every impacted module identified by flexexa-impact-analysis.
- Check stale callers, duplicate canonical types, hidden provider coupling, backward compatibility and missing tests.
- Review behavior and invariants, not formatting only.
- A changed contract without reviewed consumers is incomplete.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
