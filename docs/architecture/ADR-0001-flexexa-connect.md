# ADR-0001 — Flexexa owns connectivity; Enode is one adapter

Status: accepted design, 2026-09-09. Implements and clarifies locked V1 §§35–39; it does not replace the baseline.

## Decision
Flexexa is both an Enode customer/integration and an independent connectivity platform. It must not become a branded proxy whose customers, device identities or control semantics depend on Enode. The same canonical interfaces serve Enode, first-party OCPP/CitrineOS, later OEM cloud APIs, meters and local/Edge protocols.

Flexexa owns tenant/customer/site/asset identity, consent, permissions, capabilities, normalized state, verified command history, pricing/optimization, external APIs, SDKs and webhooks. Each provider owns only its adapter-local credentials, external identifiers and protocol translation. One physical device can have multiple read sources but only one authorized active control route for a control scope. Never issue the same action through both Enode and a direct provider.

## Mandatory boundaries
- `providers` is a versioned platform registry. `provider_accounts` and asset links are tenant owned, with composite tenant/owner foreign keys. Provider external IDs are scoped by provider account, not globally assumed unique.
- A provider connection cannot invent or move the canonical customer/site/asset owner. Linking/relinking is an authorized transactional RPC with audit, consent and idempotency. Provider-discovered data is untrusted input.
- Discovery must reconcile against existing asset links. Stable canonical asset IDs survive provider migration and disconnection. No fuzzy cross-tenant or VIN-only automatic ownership merge.
- Normalize units, timestamps, quality, freshness, capabilities and provenance at adapter boundaries. Provider acknowledgement is not verified physical execution. Manual nameplate data never grants controllability.
- OAuth callback state is tenant/user/session bound, single use and expiring. PKCE/redirect allowlists apply where supported. Secrets live in Secrets Manager or equivalent server-only vault, never plaintext browser/Postgres payloads or audit logs.
- Webhooks require exact raw-body signature verification, account/environment binding, payload version validation and delivery deduplication before changing canonical state. Enode's provider-specific verification must follow its documented protocol, not a guessed generic signature scheme.
- Commands require consent, current capability, fresh state, tenant/resource authorization, central policy decisions, an exclusive route/lease and idempotency. Route changes use fencing and draining; automatic control failover must not replay an ambiguous in-flight action.
- Disconnection revokes future access/control and credentials while preserving canonical identity and legally retained evidence. UI deletion is not a cascading deletion of audit, ledger or market records.
- Flexexa's public API/SDK/webhooks expose canonical IDs/contracts; clients do not need Enode/OEM accounts, keys or response shapes. White-label applications use the same API rather than a separate implementation.

## Delivery order
1. Verified canonical tenancy/roles, core mutations, audit/outbox/receipt integrity.
2. Provider/account/link schema and service identity authorization; connector interfaces, health, consent and route lifecycle tests.
3. Enode sandbox adapter and first-party OCPP/CitrineOS path behind the same contract; replay/simulator tests before live devices.
4. One real end-to-end smart charging flow, then direct OEM/meter/battery adapters prioritized by demand and reliability. Enode remains available where useful.
5. Flex shadow/BSP workflows consume the same canonical asset/control boundary, not a separate vendor command path.

## Completion evidence required
A simulator must exercise the same canonical read/command contract via both an Enode-shaped adapter and a first-party provider. Tests must cover cross-tenant linking rejection, repeated discovery, reconnect, expired consent, stale telemetry, bad signatures, duplicate delivery, credential rotation, rate limits, route changes, ambiguous commands and reported-versus-measured state. Live integration is not marked complete until authorized provider credentials and actual device verification are available.

The core creation PR does not implement these integrations or claim production Enode compatibility. It establishes the atomic canonical write boundary they must use. Flexexa will not become BRP; future direct BSP readiness remains a separate market-role gate.

## References
- Locked `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`, §§20–23, 35–39, 70, 78–85.
- Enode official docs: https://developers.enode.com/docs/webhooks and https://developers.enode.com/docs
- PostgreSQL transaction guarantees: https://www.postgresql.org/docs/17/sql-insert.html
