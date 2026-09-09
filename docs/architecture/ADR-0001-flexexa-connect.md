# ADR-0001 — Flexexa Connect owns connectivity; Enode is optional

Status: accepted product direction, implementation partial. User reaffirmed 2026-09-09.
Baseline: `FLEXEXA_MASTER_BUILD_PROMPT_V1.md` §§3, 35–39, 66–70, 83–87.
This clarification does not replace or silently edit the locked V1 baseline.

## Decision

Flexexa builds its own provider-neutral connectivity platform, not an Enode-branded wrapper.
A deployment must eventually be able to operate first-party OCPP/OEM/Edge adapters with
no Enode account. Enode remains a supported, optional adapter and can coexist with
first-party connections. No upstream provider owns Flexexa customer/site/asset IDs.

The product's stable path is:

Consumer/partner API → authenticated application service → canonical domain + Kernel
→ persisted command/observation boundary → selected provider adapter → device/vendor.

The optimizer, control policy, flexible capacity, BSP routing, settlement, rewards and
ledger stay in Flexexa. Enode's own optimization must not become an implicit control
authority competing with Flexexa. Real electrical limits remain local/device-enforced.

## Ownership and identity

Use the V1 `integration_providers`, `provider_accounts` and `asset_connections` models.
Every account and connection carries tenant ownership. References between connections,
accounts and assets require composite tenant foreign keys and RLS in their eventual SQL.
Enode's client-wide credential does not authorize our tenant-level API. Resolve the
opaque Enode user/account ID and asset ID from trusted persisted mappings first.

One physical asset may have several connections. Switching a route preserves its
canonical `asset_id`, schedules, history and consent. Never auto-merge assets solely
because their external IDs or user-provided VINs look similar. External identities
are scoped by tenant/provider/account. Retired bindings retain time-bounded provenance.
Credential references point to a secrets vault, never plaintext database values.

## State and routing invariants implemented in this package

The connection read model validates tenant and asset identity, lifecycle, validity,
capabilities and health. Healthy routes precede degraded routes; lower numeric priority
wins within a health class, with a stable connection-ID tie break. Degraded routing is
permitted only by an explicit versioned policy. Thresholds are supplied by policy,
not environment variables or vendor-specific constants.

Cloud connectivity time, device observation time and ingest time are distinct.
Fresh HTTP responses do not refresh stale SOC. Reads may recover stale state;
control planning requires fresh connectivity, capability evidence and device state.
The current Enode normalizer is deliberately limited to verified SOC/cloud fields;
it is NOT a complete vehicle state adapter. Missing data is never fabricated as zero.

Route selection is pure planning, NOT authentication, a distributed lock or a dispatch
service. A timeout or failed provider action is not proof that nothing was executed.
Such outcomes require reconciliation of the pinned connection, not blind failover.
The actual dispatcher must persist connection ID, policy version, authority version,
command ID and idempotency scope before I/O, and enforce one active control authority
for the physical control group (including EV/EVSE paths to the same charging load).

## Enode-specific boundary implemented here

`integrations/enode` contains the provider's SOC translation and raw-body webhook HMAC
verification. Those names and wire fields must not leak into domain/core imports.
Verification uses Enode's documented `sha1=` HMAC over the ORIGINAL bytes. SHA-256 is
used for Flexexa receipt hashing. The unsigned delivery-ID header is not the sole
replay key. The receipt namespace comes from a trusted subscription, never a payload
claim about tenant ownership. Provision cryptographically random secrets in the vault;
a string-length check cannot prove secret entropy.

The helper returns verified bytes/text and a content-addressed receipt key. It does
not acknowledge a webhook, write an inbox or call a device. A future ingress must
atomically persist the durable inbox before success, validate event versions against
the registered schema, map each account to its tenant, and process bounded events via
workers. Duplicate bodies must not re-execute side effects. Replay retention must cover
provider redelivery windows, and retries must recover unfinished receipts rather than
silently discard them. Original payload retention must follow privacy policy.

## Remaining before any real-device connection

Implement and test credential lifecycle, OAuth linking/state/redirect validation,
discovery, verified account/asset mapping, capability normalization, device shadow,
webhook subscription and event schemas, durable inbox/outbox, control transactions,
command fencing/reconciliation, rate limits/backoff, provider health and disconnect
revocation. Implement Vehicle/Charger/Battery/Solar/Meter/HVAC lifecycle ports as their
canonical models become available; the current code has only the read-provider port.

First-party path: OCPP/CitrineOS plus simulator first; direct OEM adapters by demand.
Enode path: sandbox first, then explicitly approved production credentials and devices.
Contract tests and physical-device interoperability are different gates. None of the
new modules is evidence of a live Enode connection, live OCPP charger or BSP access.

## Sources reviewed 2026-09-09

- Enode device data: https://developers.enode.com/docs/integration-guide/device-data
- Enode control/actions: https://developers.enode.com/docs/integration-guide/controlling-devices
- Enode webhooks: https://developers.enode.com/docs/webhooks
- Enode OAuth/client scope: https://developers.enode.com/docs/integration-guide/accessing-the-api
- Turborepo packages: https://turborepo.dev/docs/crafting-your-repository/creating-an-internal-package
