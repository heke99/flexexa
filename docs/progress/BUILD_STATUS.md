# Flexexa build status and ordered gates

Updated: 2026-09-09. This is an evidence ledger, not a percentage-complete estimate.

## Current phase: 0 — in progress

| Boundary | Evidence / state |
|---|---|
| Canonical core database | PR #5 merged into foundation; schema parity and 70 DB assertions verified. |
| Tenant-owned roles and temporal authorization | PR #6 merged as `52026db9095b8ea174eac4cd1c7d69d73947c34d`; final run `34355760089` passed 105 DB assertions; exact dev migration checksum matched; 12 additional live assertions passed with rollback; security advisors clean. |
| Canonical TypeScript and real quality gates | PR #4 merged as `bdd0b2674aed026196d69a3349225ea1f2d8577d`; synchronized run `34356606525` passed frozen install, lint, typecheck, tests, build and DB replay. |
| Transactional core writes | PR #7 merged into foundation with final tracked replay: 150 DB assertions, 82 SQL/TypeScript cases and 32 concurrent calls. Exact dev SQL is `20260909135947`. |
| Own Enode-like platform plus Enode adapter | PR #8 merged; optional Enode normalization/HMAC and provider-neutral canonical routing verified. PR #9 merged as `2cf62efcaef10ead9a47dc37791addee7227c113`: 201 DB assertions, SQL/TypeScript route parity and binding races passed; exact SQL verified in dev as `20260909151938`. No OAuth, consent or live control claimed. |
| Provider account transactions | PR #10 merged as `24318e420ff9db0e7d3a4ce322050f31384de632`; run `34373803112` passed all ten migrations, 246 DB assertions, 144 shared contract cases and 92 concurrent calls. Exact migration `20260909155618` verified in development. |
| Typed mutation transport | PR #11 merged as `9dc79da2477955f9d47c2e355621928316c8053a`; final run `34374858422` passed application and database round trips. |
| Published local Connect recovery | PR #12 merged as `4f66e2305eed804ef8903a831da709aedcab3057`; corrected clean-source ESM bootstrap and preserved all ten migrations. Final run `34386537689` passed both jobs. Prior local work is published/reconciled, not every planned phase implemented. |
| Machine authorization | PR #13 merged as `fb8d081b3a042d836837ddbcc10d3191173c769e`; final tracked run `34389879469` passed. Migration `20260909183109` verified in development. 307 SQL assertions and current-session preflight are active; no credential issuer. |
| Audited API identity administration | PR #14 merged as `55db456dce07c0620f4f2d6138d5ab6590692b10`; final tracked run `34393440885` passed app and database. Exact dev migration `20260909190638` verified. Dedicated pre-attested subject only; no live Auth provisioning or credentials. |
| Rules/policy | Deterministic primitives exist; full versioned registry, publishing, approval and readiness are not finished. |
| AWS | Bootstrap/state/OIDC documented. Normal application resources have not been applied by this change. No claim of running ECS/RabbitMQ/Valkey/ClickHouse. |
| UI/deployment | Next.js shell and preview builds exist; no end-to-end smart charging UI or production readiness. |
| Remaining foundation | Scoped service/client authentication, approval/break-glass, outbox publisher, provider architecture, country packs, observability, Docker/runtime dependencies, infrastructure verification and restore/security/load gates. |

## Whole-plan coverage

`pnpm plan:check` inventories all 88 sections and 14 phases of the locked source.
`pnpm plan:ready` deliberately refuses completion while individual source points lack
reviewed, current evidence. See `masterplan-traceability.md`; coverage integrity is not
product acceptance. Existing implemented boundaries retain the evidence above.

## Sequential continuation
Complete the separately privileged Auth provisioning integration after the merged identity administration boundary, then authorized consent/link/discovery and central policy/readiness; finish runtime infrastructure and full Phase 0 gates before claiming the foundation complete. Each PR preserves prior tests and migrations. No destructive history rewrite, no skipping failed gates, no silent tenant/schema/contract divergence.

The locked phase sequence remains: 1 smart charging MVP; 2 full Swedish true cost; 3 direct connector expansion; 4 flex shadow; 5 BSP pilot; 6 multi-BSP; 7 local flex; 8 solar/battery/HEMS; 9 Edge/OEM; 10 licensed Nord Pool data; 11 country expansion; 12 direct BSP readiness; 13 V2G. These later phases remain planned, not delivered.

External vendor credentials, device/protocol qualification, commercial data rights and market-role approvals must be recorded as external gates. Simulators and code interfaces are not substitutes for successful live verification. No real bids, settlement money or physical commands until their corresponding safety/authorization gates pass.
