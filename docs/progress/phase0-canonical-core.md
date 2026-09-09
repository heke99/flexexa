# Phase 0 canonical core verification

## Scope
Core database field/enum alignment with V1, not complete Phase 0. The five preceding migrations remain unchanged. The indexed canonical field comparison identified legacy provider-style names and missing core columns; these are corrected before introducing RPC consumers.

## Executed evidence
- PR #5 source head 779a37b0dfa309daaf6bcf2913a64e602199d4bc.
- GitHub run 34350480015: real isolated Supabase start, clean replay, 70 pgTAP assertions and application-scope verification passed.
- CLI generated 20260909122056_phase0_canonical_core_v1.sql during review.
- Artifact 10103548440 contains the exact tested SQL, SHA-256 ffd5ae27dc138b1a7f3ae96a430af342075f0d5c616c21e36963fb99ae68289e.
- The Supabase migration API assigned version 20260909122536 when applying the same SQL to Stockholm dev. The committed filename uses that authoritative remote version to prevent history divergence; no manual history repair was performed.
- Live read-back confirms canonical ev/evse/battery/... enum, four Swedish market rows, customer contact fields and eleven tenant-immutability triggers. No business/customer/user rows were created.
- The temporary proposal generation step is removed. A second CI run must replay the tracked final migration before merge.

## Remaining
Tenant-owned custom roles/full permission catalog and temporal grants are the next isolated migration. Brand/domain fields, central policy registry, application RPCs, audit/outbox/idempotency and other V1 domains remain separate steps. PR #4 owns the complementary TypeScript/quality improvements; do not overwrite it.
