# Connect foundation promotion — 2026-09-09

The previous local-only handoff is historical. PR #8 now publishes that package on
`feat/phase0-connect-foundation`, targeting the working `phase/0-foundation` branch.
No production/main merge, remote database DDL or device control is part of this PR.

## Source integrity and synchronization

Merged foundation `bdd0b2674aed026196d69a3349225ea1f2d8577d` has the exact source tree
`1c0732178dad25edd2aac788ad10ee054744a1ef` used by the earlier package. Published
candidate `b7dd6571d5ab5dc31e8144528b0dad7d2527bf79` reproduces its complete result
`cbd64ac8e74f871c83ab14c405226f45d4f9b776`. Seven historical migrations and the normal
tracked-only database workflow remain unchanged. A temporary no-checkout job only
published the checksum-reviewed workspace lock blob; it is absent from the final
source tree and never changed a branch ref. No new registry packages were added.

PR #7 owns core transactional writes, shared input validation and concurrency tests.
This PR does not replace those changes. The detailed provider boundary is named
`docs/architecture/connect-adapter-boundary.md` to coexist with #7's architecture ADR.
After either merge, preserve the other side, synchronize and rerun the combined suite.

## Executed evidence

- CI run `34360583310`, candidate `b7dd6571...`: pinned application job passed frozen
  pnpm installation, real lint, typechecks, tests and Next.js build. Its clean database
  replay and pgTAP steps passed. Final workflow completion is checked before merge.
- Supplemental local tests after the explicit signature-length regression: 66/66
  source tests passed on Node 22.16.0; this is not a substitute for Node 24 CI.
- Enode's documented raw-body `sha1=` HMAC vector passed; whitespace/line-terminator
  signature inputs are rejected. Body identity is subscription-scoped, not based
  only on an unsigned delivery header. No external Enode requests were executed.
- Dependency lock review: only an Enode workspace importer, existing pins/resolutions
  unchanged; SHA256 `8249df0e19a3e37c4af5edb6cb86ff549da490234333a856154a602366b4fade`.

The final head must pass its own pinned application and database run; the exact run,
head and head-locked merge are recorded in PR #8. A historical green run must not be
reused after a code change. Sandbox/device tests are still mandatory before real
connectivity; they are not claimed by these non-networked adapter primitives.

## Skill routing

Activated: Supabase and project PostgreSQL/security/verification overlays; Turborepo;
codebase-index, impact-analysis, affected-verification, code-review and test-strategy.
Vercel/AWS runtime and browser implementation skills are conditional: no runtime,
UI, electrical control, credentials or infrastructure are changed in this PR.

## Next boundary

Finish the verified core mutation boundary from #7, then implement the canonical V1
`integration_providers`, `provider_accounts` and `asset_connections` tables with
composite tenant/customer/provider relationships and authenticated lifecycle writes.
Enode remains optional: first-party connectors keep Flexexa's canonical identity and
must work without an Enode account. Phase 0 is not yet complete.
