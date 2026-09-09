# Reconciliation of earlier local Connect deliveries

Date: 2026-09-09. Publication base: PR11 head
`0b8e40f4dba9e3f0c61eaff824efd7f220f504b4`, tree
`d3edd751236eba46fef0369d01e796b48fbc211a`.
The reviewed source artifact SHA256 was
`6f1cb3ef68152ccd9ea1386e979234ba6038498c3b092e0f179721601c3f4d80`.

All three earlier local ZIPs are superseded as patch inputs. Their changes were compared
against PR8–11 instead of applying a stale patch to the newer database/contract baseline.
This report explains every file from the last 24-file local manifest.

## Recovered and adapted

- `packages/api-contracts/src/connect-registry.ts` and its tests: exact current RPC
  name, current scope names, complete bounded response validation and sparse-array rejection.
- `packages/api-contracts/package.json`: adds only the reader export; retains PR11 rpc export.
- `packages/domain/src/connect.ts`: retains current names; restores PostgreSQL int4
  priority bound and required top-level SOC environment. Its additional environment
  tests are restored in `packages/domain/test/connect-environment.test.mjs`.
- `integrations/enode/src/normalize-soc.ts` and tests: environment plus version-2 output.
- `packages/kernel/src/connection-routing.ts` and tests: validate scope before empty results;
  preserve newer upstream tests and add both-direction environment checks.
- `scripts/quality/impact-core.mjs` and tests: contract-only and database-runner changes
  require real SQL/RLS/replay and RPC/concurrency evidence.
- `docs/architecture/ADR-0002-connect-registry-environments.md`: rewritten to distinguish
  the implemented contracts from the deferred lifecycle proposal.
- The old `docs/progress/phase0-registry-continuation.md` is superseded by this report.

## Already published or superseded — intentionally not duplicated

- `AGENTS.md` and `docs/progress/BUILD_STATUS.md`: newer PR7–11 instructions retained,
  including the own-platform / optional-Enode mandate; no stale progress overwrite.
- `packages/api-contracts/src/core-rpc.ts` and its tests: superseded by PR11
  `src/rpc.ts`, `test/rpc.test.mjs` and real database round trips. Do not add a second
  mutation transport implementation beside the six canonical methods.
- `packages/domain/test/connect.test.mjs`: current environment tests retained; omitted
  supplemental edge coverage is supplied by the restored environment test file.
- `supabase/proposals/phase0_connect_registry.sql` and its proposed SQL tests: superseded
  by PR9's actual migration, PostgreSQL tests and race runner. No old SQL is reintroduced.

## Design preserved, not falsely activated

The old kernel `connection-lifecycle.ts`, its test file and fixture, and its package
export are NOT restored as executable code: their claimed full SQL matrix parity was
not true of the current migration. The 25-edge intent is preserved under
`docs/proposals/connect-lifecycle-v1.json`; ADR-0002 states the remaining work.
`packages/kernel/package.json` stays unchanged until shared SQL/kernel enforcement exists.

## Verification and boundaries

The downloaded base reconstructs the exact PR11 Git tree. Its 243 source tests passed
locally before recovery. New source tests and supplemental typechecking are recorded in
the PR; Node22/TypeScript5.8 local checks do not replace pinned Node24/TypeScript7 CI.
The permanent database route verifier now consumes the restored reader without removing
any prior replay, RLS, contract, race or RPC round-trip checks.
All ten migration files, lockfile, workflow and locked master plan remain unchanged.
No Supabase DDL, live provider calls, credentials, AWS apply or physical commands.

Skills: activated canonical/impact/code-review/security/verification and Supabase guidance;
conditional database replay through CI. UI, browser, Vercel deployment and AWS changes
are intentionally out of scope. Phase 0 remains open.
