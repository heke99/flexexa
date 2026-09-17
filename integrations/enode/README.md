# Enode adapter primitives — not a live connection

Part of Flexexa's own Connect layer. Do not import this package from canonical domain,
Kernel, optimizer, public browser bundles or settlement code. An authenticated connector
service will be its consumer after the database/credential/inbox/outbox gates are ready.

Implemented: SOC normalization with trusted tenant/account/asset binding and separate
cloud/device timestamps; raw-body HMAC verification and content-addressed receipt keys.
No access tokens, real vendor accounts, HTTP calls or device commands are included.

`normalizeEnodeSoc` expects a full fetched vehicle, not a partial event patch.
`verifyEnodeDelivery` does not parse events, route tenants, acknowledge delivery or
persist deduplication. Its output must feed the future transactional inbox and
versioned event decoder; a signed body is not itself permission to control a device.

Run package tests through `pnpm --filter @flexexa/enode-adapter test` in the pinned
workspace toolchain. See docs/architecture/connect-adapter-boundary.md for security invariants and remaining implementation.
