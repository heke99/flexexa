# Phase 0 — signed power-policy snapshot primitive

Scope: locked sections 11–14. This implements a cryptographic power-snapshot boundary,
not the publication service or an authorization/physical-control endpoint.

The exact locked snapshot fields are preserved: tenant_id, scope, policy_set_version_id,
rules_checksum, valid_from, valid_until, compiled_constraints and signature. This profile
uses tenant/site/asset scopes with explicit sandbox/production environment inside scope.
Compiled constraints contain finite power bounds, canonical applied rule-version IDs
and bounded reason codes. Existing Kernel validation is reused; all returned nested
objects and arrays are frozen and detached from caller input.

Ed25519 signs UTF-8 `flexexa.power-policy-snapshot.v1\n` followed by JSON serialization
of `{key_id,payload}`. Payload field order is the parser's explicit order, timestamps
are normalized UTC milliseconds, UUIDs lower-case, and evidence arrays sorted/deduped.
This is a versioned Flexexa power profile, not a claim of general RFC 8785 support.
The signature is strict unpadded base64url for 64 bytes. Key ID is signed; algorithm
substitution is rejected. WebCrypto performs signing and verification; an independent
Node crypto verifier checks interoperability in tests. No crypto algorithm is reimplemented.

Verification requires a separately trusted tenant, resource scope, environment, current
policy version/checksum, public key/key ID and key validity window. These cannot be
obtained from the received snapshot itself. Effective time must come from the trusted
control clock; a caller-supplied historical time is not live authorization. Both snapshot
and key intervals are half-open. Wrong scope, stale pinned version/checksum, wrong key,
expired/not-yet-valid validity, invalid signature and unknown fields fail closed.
A valid signed deny remains a deny; signature validity alone is never permission to act.

Signing is a trusted-publisher primitive. Production key custody/rotation/revocation,
rule test/shadow evidence, independent approval, durable publication/audit, tenant
readiness, cache/distribution, fallback and local physical safety remain required before
it can be used for control. The signing function does not attest those prerequisites.
All test keys are ephemeral in memory; no private key or hosted secret is persisted.
No SQL migration or live command is involved in this change.

Activated repository index/impact/full affected verification, code/security review and
test strategy. Reviewed master sections 9–14/83–85, AGENTS, skills-lock, Kernel consumers
and current Node 24 WebCrypto documentation. Browser/AWS deployment and DB mutation
skills are skipped for this pure primitive; existing full database/Auth/runtime CI and
fresh development migration/catalog parity still gate merge because Kernel is HIGH risk.

Source reference: [Node 24 WebCrypto](https://github.com/nodejs/node/blob/v24.20.0/doc/api/webcrypto.md).
Exact final CI and merge evidence are recorded in the PR; this does not complete Phase 0.
