# Phase 0 Connect registry — scoped work

Base: merged PR #8, cbc7ef0f45970c6d72d144e149d46ba6727fcb81.
This is NOT completed Phase 0, OAuth linking, consent or live device control.

Activated skills: Supabase, Postgres best practices, verification, repository index,
impact analysis, code/security review and test strategy. UI/browser and AWS apply
are intentionally not part of this database/contract change.

## Boundary
- V1 provider/account/asset-connection tables, canonical tenant/customer/asset identity.
- One customer per account now; shared fleet/service credentials need explicit future
  grants. No nullable owner silently provides cross-customer access.
- Required sandbox/production environment in SQL FKs, canonical bindings, Enode
  normalization and Kernel routing. No default environment and no implicit Enode.
- External bindings cannot overlap; historical intervals and identities cannot be rewritten.
- Credentials stay in the vault; even credential references are not browser-selectable.
- Suspended Enode/OCPP catalog entries do not assert supported live connectivity.
- Invoker route reads require permission and underlying RLS; archived owners are excluded.
- Registration does not authorize control. Revoked state remains visible to the Kernel
  for rejection; actual consent, control authority and durable command fencing come later.

## Executed verification
- Proposal source `1c0552f3331ec0f948665ada3c67721a499a82b0`.
- Run `34368966710`: clean isolated Supabase replay, all 201 pgTAP assertions,
  82 shared core SQL/TypeScript fixtures, 32 core RPC race calls and 12 registry
  binding race calls passed. One external-binding winner, eleven rejected overlaps.
- Actual authenticated SQL route results for Enode and first-party OCPP were parsed
  by the canonical TypeScript parser; original observation timestamp was preserved.
- Run `34368966657` application job passed frozen install, lint, typecheck, source
  tests and Next.js build. The proposal-stage tracked-only DB job correctly failed
  before the new migration was committed; it was not bypassed or called green.
- Reviewed artifact `10111165054`, SQL SHA256
  `27ebf4b9e3fa4028ddd07103a8db60260ef7ce62d7b442ccde3b4098f13af9a6`.
- Exact SQL applied to Stockholm development; authoritative version
  `20260909151938`. Read-back matched all 13,973 bytes and the SHA256.
- Live read-back: all three registry tables RLS enabled, six FKs, one temporal
  exclusion, invoker route RPC, no anon EXECUTE, no browser credential-reference
  SELECT, no customer/account/connection rows persisted. Providers stay suspended.
- Security advisor: no new WARN/ERROR. Two existing INFO entries for intentionally
  private outbox/idempotency tables with no browser policy remain; do not open them.
- Temporary proposal SQL/workflow removed. Final tracked-only replay of this exact
  committed migration and all canonical/concurrency checks is required before merge.

Sources reviewed: Supabase Database Functions and RLS documentation, PostgreSQL 17
constraints/exclusion constraints; locked V1 sections 35–39. No new provider API behavior
is assumed here. No credentials or customer data are copied into CI.
