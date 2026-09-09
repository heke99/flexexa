# Phase 0 Connect — tested local implementation and exact handoff

Date: 2026-09-09. **Not pushed, not merged, not deployed. Phase 0 remains incomplete.**

## Product requirement (binding)

Flexexa must support Enode AND operate as its own provider-neutral connectivity
platform. The canonical inventory, customer/site/asset identity, policy, control,
optimizer and settlement belong to Flexexa. Enode is replaceable; first-party
OCPP/OEM/Edge routes must work without an Enode account. Read
`docs/architecture/ADR-0001-flexexa-connect.md` before extending this code.
The locked V1 master document is unchanged.

## Source and synchronization

This change is additive to upstream PR #4 at
`50ba82837e4c0f8e2a14dbbb6b1918d0408423d3`, tree
`1c0732178dad25edd2aac788ad10ee054744a1ef`. That revision already includes the
merged PR #6 / foundation `52026db9095b8ea174eac4cd1c7d69d73947c34d`.

The source was retrieved from GitHub Actions run `34356606525`, artifact
`10106084272`; archive SHA-256:
`07560d5a6ae9e05dee75ff4580691e28f5483937b1d1abeddbe8ed6a734f61d1`.
The reconstructed local Git tree matches the upstream tree exactly. The delivered
patch does not reapply PR #4 or #6, modify the database workflow, or alter any of
the seven applied migrations. It does not reintroduce the retired SQL proposal.

Concurrent upstream edits were observed. A clean worktree and an exact source-tree
match are required by the supplied apply script. On mismatch, STOP and review/rebase
against the new branch; never use force, checkout-overwrite or a database history edit.
Local Git commits in the source reconstruction are not published GitHub commits.

## Implemented in this local change

- Canonical `@flexexa/domain/connect` bindings/read models, account-scoped external
  identity, exact capabilities, lifecycle and time-bound validity checks.
- Pure, version-bound `@flexexa/kernel/connection-routing` selection independent
  of provider names. Freshness, tenant/asset identity, health and priority are
  validated. Unknown dispatch outcomes pin reconciliation instead of blind failover.
- `integrations/enode`: limited SOC/cloud-state normalization and documented
  raw-body webhook HMAC verification. No live provider client or credential access.
- Workspace subpath indexing and reverse dependency propagation; explicit review
  gates for database workflow, dependency lock and integration changes.
- Regression tests for the provider boundary and byte-identical historical SQL.
- A binding architecture record, agent instructions and this handoff.

## Executed local evidence and limits

The separate delivery evidence includes Node source-level test TAP, global TypeScript
checks, lock-structure validation, index/impact output and patch round-trip checks.
Local toolchain: Node 22.16.0 and TypeScript 5.8.3; workspace source symlinks used.
This is NOT a pnpm installation or the pinned Node 24 / TypeScript 7 build.
No remote database DDL, AWS changes, Enode calls, control actions, GitHub writes,
merges or new deployments were performed from this session.

Upstream CI success for `50ba828...` does NOT certify this additive patch. Required
before merge: pinned frozen install, lint, typecheck, full tests/build, tracked-only
Supabase replay and 105 existing pgTAP assertions, provider contract review and
future real sandbox integration checks. The local environment has no pnpm or Docker;
these gates are recorded as blocked/not executed, not passed.

## Sequential continuation — do not skip readiness gates

1. Read current PR #4 / foundation status. Integrate this minimal patch on a clean
   topic branch based on the reviewed source; resolve later upstream changes first.
   Run full pinned CI on the exact final head. Merge only if the required gates pass.
2. Complete Phase 0 transactional write boundaries: authorization and tenant-scoped
   RPC/service transactions; audit + durable inbox/outbox + idempotency; service/API
   identity, approval/step-up/break-glass. Test concurrent requests, revocation,
   duplicate payloads and rollback. A pure routing function is not any of these.
3. Implement V1 provider registry/accounts/connections in SQL with composite tenant
   FKs, unique account-scoped external IDs, credential references, stable IDs,
   temporal retirement, query-specific indexes and RLS. Add new forward migrations
   and pgTAP tests BEFORE exposing write consumers; never rewrite applied history.
4. Implement the remaining provider lifecycle and first-party simulator/OCPP path.
   Add Enode sandbox OAuth/linking, trusted user/asset mapping, discovery, capability
   normalization, durable signed-webhook ingestion, device shadow, rate limits,
   fencing and reconciliation. Test Enode-free operation and route change without
   changing canonical asset identity. Define one physical control authority across
   EV and EVSE paths so independent adapters cannot issue conflicting commands.
5. Complete and verify remaining Phase 0 infrastructure and operational readiness:
   AWS plan/approved apply, RabbitMQ, Valkey, ClickHouse, telemetry provenance,
   observability, provider/country-pack structure, backup/restore and security.
6. Then Phase 1: prices/tariffs + charging preferences + deterministic optimizer +
   safe real command execution and measured result, white-label portals/API/webhooks.
   Prove the customer's charging target before departure; do not infer success from
   provider acceptance. Gate real devices with explicit credentials, consent,
   sandbox/interoperability results and local electrical safety constraints.
7. Continue V1 §83 in order: Phase 2 true cost; 3 direct connectors; 4 flex shadow;
   5 BSP pilot; 6 multi-BSP; 7 local flex; 8 solar/battery/HEMS; 9 Edge/OEM;
   10 licensed Nord Pool data; 11 countries; 12 direct BSP readiness; 13 V2G.
   No phase is complete until its relevant V1 Definition of Done is evidenced.

## Not implemented / no implied guarantees

No exposed customer API, complete provider lifecycle, durable webhook ingress,
actual command outbox, distributed reservation/locking, physical device simulator,
OCPP connection, live Enode connection, optimizer, live settlement or production
readiness is delivered here. Physical safety and cross-process exactly-once effects
are not proven by unit tests. Later operators must not infer them from a green
source-level test suite or a Vercel READY state.
