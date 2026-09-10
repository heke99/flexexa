---
name: flexexa-impact-analysis
description: "Determine direct and transitive effects of a diff before implementation and review."
priority: critical
---

# flexexa-impact-analysis — Flexexa repository skill

## Purpose
Determine direct and transitive effects of a diff before implementation and review.

This is a Flexexa-native skill and is authoritative for its project-specific scope.

## Mandatory rules
- Run pnpm impact -- --base <base-ref> for every non-trivial PR.
- Canonical/kernel/events/API-contract/DB/RLS/rules/optimizer/dispatch/settlement/ledger/IaC changes are HIGH risk.
- Use reverse imports plus domain-specific path rules; do not rely only on Turborepo.
- Report changed files, direct/transitive dependents, affected contracts/data/events/tests and required verification.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill and any declared upstream skill
4. Current vendor/framework documentation

## Completion
Do not report completion without executing the verification implied by the change risk and preserving tenant isolation, canonical boundaries, idempotency, auditability and architecture constraints.
