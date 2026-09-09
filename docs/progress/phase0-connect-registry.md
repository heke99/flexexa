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

## Verification discipline
All eight previous migrations and all earlier tests are retained. The temporary
proposal workflow uses a CLI-generated migration in disposable Supabase only.
The permanent database workflow must remain tracked-only; it is expected to fail
until the exact verified migration is promoted/committed and the proposal removed.
Do not merge on proposal evidence alone. Final pinned application + tracked replay
and live dev read-back are mandatory.

Sources reviewed: Supabase Database Functions and RLS documentation, PostgreSQL 17
constraints/exclusion constraints; locked V1 sections 35–39. No new provider API behavior
is assumed here. No credentials or customer data are copied into CI.
