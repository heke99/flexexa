# Typed canonical RPC boundary

Base: verified PR #10 merge `24318e420ff9db0e7d3a4ce322050f31384de632`.

The exported `@flexexa/api-contracts/rpc` factory accepts a trusted tenant context
and an authenticated session-bound client. Six named methods reuse canonical
request normalization and call only the six matching PostgreSQL functions.
Database authorization is independent; passing a tenant ID is not authentication.

Responses are validated for tenant, resource kind, UUID, operation outcome,
idempotency key and (for provider accounts) exact environment/account identity.
A replay preserves the original receipt/correlation ID. Unexpected response fields,
raw database details and transport exceptions cannot be exposed as successful results.
No automatic retries, credential configuration, generic SQL or device control exists here.

Twenty transport unit tests supplement the existing tests. The permanent DB job
also runs eight calls through these TypeScript methods into real authenticated
PostgreSQL: all six functions and two durable replays. Expected exactly six receipts,
audits and outbox facts; registered assets remain non-controllable. The test harness
requires disposable loopback settings AND explicit loopback connection arguments.
It is not an application driver and cannot be used against development/production.

No migration, external dependency, lockfile, permission or runtime infrastructure change.
The real HTTP/PostgREST transport, endpoint authentication and UI remain separate work.
Final frozen application and ten-migration replay/concurrency results are recorded in the PR.

Skills: canonical contracts, impact analysis, verification and security review.
Next: service/client identity and consent/link/discovery; no provider activation until those gates pass.
