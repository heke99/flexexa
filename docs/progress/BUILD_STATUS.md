# Flexexa build status and ordered gates

Updated: 2026-09-10. This is an evidence ledger, not a percentage-complete estimate.

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
| Identity administration transport | PR #16 merged as `ed01da2e18f6579b97a37568d4fd6b7ef9e92482`; final run `34409212402` passed pinned application and complete database replay/RLS/concurrency gates. |
| Durable identity provisioning request | PR #17 merged as `ecb82b7cd19cd9cc31aa05d2ab5648f33bda1bbf`; final run `34445226936` passed application and database gates. 392 SQL assertions and all concurrency checks; exact development migration `20260910062435` verified. No credentials or Auth users issued. |
| Identity execution coordination | PR #18 merged as `b5e1956d9ff73bedf4373c0e7a6ad4bf65f3958d`; final run `34447623811` passed. 445 SQL assertions and all prior concurrency checks plus 24 lease races; exact development migration `20260910065545` verified. No running worker or external Auth I/O. |
| Typed lease transport | PR #19 merged as `b238718b09e8a78fe41edcaefd480e00dd9e17db`; run `34448449838` passed 475 application tests, 445 SQL assertions and real typed lease races/checks. |
| Atomic provisioning finalization | PR #20 merged as `a9611c9b7502d62a15dba6da753c76f80350e28e`; final tracked run `34450850188` passed application, 489 SQL assertions and all concurrency gates including 16 typed finalizations. Exact development migration `20260910073558` verified. |
| Migration history synchronization | PR #21 merged as `4b3056130855473a0669300fedb740a38af59e02`; final run `34451757476` passed. Permanent source/base history gate and fresh development snapshot checker; 15 pinned migrations, four exact reviewed historical formatting exceptions. See [verification procedure](../quality/migration-synchronization.md). |
| Application schema parity | PR #22: run `34452939530` passed full replay and tests; all 914 live application catalog entries match the clean replay, with zero differences. Final tracked CI/merge evidence is in the PR. See [scope and procedure](../quality/schema-parity.md). |
| Reserved Auth provisioning backend | PR #23 merged as `8e0133b07aea0d8f4fb83d1a45a610242bbc589b`; final run `34458107930` passed: 32 service tests, 489 SQL assertions, real TOTP MFA, three actual isolated Auth subjects, lost-response recovery and four concurrent HTTP executions. No hosted deployment or credential issuance claimed. |
| Identity container | PR #24 merged as `a71336494c4d1ed1721192e927fd5dc29195cd14`; final run `34460495957` passed real container Auth/MFA/recovery/concurrency, signature verification, read-only/non-root runtime, clean shutdown and zero HIGH/CRITICAL image findings. Final pinned CI evidence is in the PR. No deployed ECS service claimed. |
| Country-pack structure | PR #25 merged as `caf55c1816e2989f8e53ac1b416a395c90b2c19b`; final run `34462489028` passed 502 SQL assertions and full application/Auth/container gates. Immutable Swedish metadata synchronizes API and nine SQL defaults without changing V1 behavior; exact dev migration `20260910094434`, all 16 history entries and 915 catalog objects verified. Final tracked CI evidence is in the PR. Tax/market domains remain gated. |
| Valkey runtime | PR #26 merged as `ba4011230f3d9ec7db1db4eaeb7fea283a955d83`; final run `34463690286` passed protocol/isolation, nine negative cases, 24 lease races, expiry/restart and image scan. No app integration or AWS deployment claimed. |
| RabbitMQ runtime | PR #27 merged as `e5576707fecc405674112edf65f565f9e8ffd17d`; final run `34465947212` passed all four jobs, actual canonical AMQP delivery/failure/restart, five denials and image/client scans. OpenSSL CVE-2026-14456 fixed without exclusions. Fresh 16-migration/915-object parity verified. No business outbox/inbox or AWS deployment claimed. |
| ClickHouse runtime | PR #28 merged as `bf7552b728fe3deb9a7c75c7293f015dcc996de0`; final run `34467000988` passed all five jobs, real SQL tenant/type/retention/restart checks and image scan. Exact source migration hashes and permanent forward-history gate added. No production ingestion or AWS deployment claimed. |
| Identity HTTP diagnostics | Structured allowlisted logging and per-request correlation candidate. Real HTTP privacy/concurrency tests and full Auth/container gates required; final evidence in its PR. Full OpenTelemetry/metrics/alerting still pending. |
| Rules/policy | Deterministic primitives exist; full versioned registry, publishing, approval and readiness are not finished. |
| AWS | Bootstrap/state/OIDC documented. Normal application resources have not been applied by this change. No claim of running ECS/RabbitMQ/Valkey/ClickHouse. |
| UI/deployment | Next.js shell and preview builds exist; no end-to-end smart charging UI or production readiness. |
| Remaining foundation | Scoped service/client authentication, approval/break-glass, outbox publisher, provider architecture, remaining country domains, observability, Docker/runtime dependencies, infrastructure verification and restore/security/load gates. |

## Whole-plan coverage

`pnpm plan:check` inventories all 88 sections and 14 phases of the locked source.
`pnpm plan:ready` deliberately refuses completion while individual source points lack
reviewed, current evidence. See `masterplan-traceability.md`; coverage integrity is not
product acceptance. Existing implemented boundaries retain the evidence above.

## Sequential continuation
The reserved Auth service, hardened container and country metadata structure now have isolated integration evidence. Continue runtime dependency/infrastructure verification, observability, central policy/readiness and authorized consent/link/discovery; complete the remaining Phase 0 gates before claiming the foundation complete. Each PR preserves prior tests and migrations. No destructive history rewrite, no skipping failed gates, no silent tenant/schema/contract divergence.

The locked phase sequence remains: 1 smart charging MVP; 2 full Swedish true cost; 3 direct connector expansion; 4 flex shadow; 5 BSP pilot; 6 multi-BSP; 7 local flex; 8 solar/battery/HEMS; 9 Edge/OEM; 10 licensed Nord Pool data; 11 country expansion; 12 direct BSP readiness; 13 V2G. These later phases remain planned, not delivered.

External vendor credentials, device/protocol qualification, commercial data rights and market-role approvals must be recorded as external gates. Simulators and code interfaces are not substitutes for successful live verification. No real bids, settlement money or physical commands until their corresponding safety/authorization gates pass.
