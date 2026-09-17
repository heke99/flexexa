# Phase 0 core mutation verification

## Executed evidence — 2026-09-09
- Source head `c13d1cc51486fec6f139fd362ebce04ec8e3ac2e`; run `34360008549`, database job `102494263506`.
- Isolated Supabase clean replay: five test files, **150 pgTAP assertions PASS** (105 preserved + 45 new).
- Cross-language canonical normalization: **82 independently specified cases PASS** in SQL and TypeScript.
- Real contention: **32 simultaneous-call tests**, with 16 identical replays, eight mixed-race winners and eight rejected conflicting payloads. Exactly two customers/receipts/audits/outbox entries, zero unfinished receipts.
- Pinned application verification: frozen install, lint, typecheck, real tests and Next.js build PASS. Supplemental local Node run: 111 tests PASS.
- Reviewed artifact `10107491298`; SQL SHA-256 `a63e6434eb93f2fab9674c73c620bd617b56024a9afd2d00527afa05f9850ed3`.
- Identical SQL applied to Stockholm development database; API-assigned migration version `20260909135947`. Stored remote SQL checksum matches exactly, no migration-history rewrite.
- Authenticated live customer → site → meter → asset creation and duplicate/conflict/tenant/evidence checks PASS. All synthetic rows rolled back; assets remain uncontrollable.

## Security read-back
No advisor ERROR/WARN findings. Two INFO `rls_enabled_no_policy` notices are intentional: `idempotency_records` and `outbox_events` have RLS with default deny, no browser grants and no browser read/write policies. Do not add permissive policies to silence the advisory. A later scoped publisher needs a reviewed service boundary.

## Final promotion gate
The proposal materialization step is removed and the same SQL is a tracked migration. Before merge, a new pinned CI run must replay all tracked migrations and repeat all database/contract/concurrency/application checks. This file records executed proposal/dev evidence, not a claim that unobserved future checks passed.

## Limits
Four creation RPCs only; no edit/purge endpoints, publisher, physical device commands, live Enode connection, rules publication, production deployment or AWS apply. ADR-0001 and AGENTS preserve the own-platform-plus-Enode requirement. Continue from the current merged foundation and retain all preceding tests.
