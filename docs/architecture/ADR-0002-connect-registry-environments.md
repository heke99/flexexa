# ADR-0002 — Connect environments and pending lifecycle design

Status: reconciled source boundary; lifecycle matrix remains a non-executable proposal.
Date: 2026-09-09. Read ADR-0001 and the locked master plan first.

## Current canonical contracts

`ConnectionScope` and provider identity explicitly bind tenant, asset and `sandbox`
or `production`. Keep the PR9 names `connectEnvironment` and
`flexexa_get_connection_routes`; do not restore the older local aliases or RPC name.
The recovered reader validates all rows, rejects duplicate IDs, sparse arrays,
secret/unrecognized fields and more than 1,000 rows rather than truncating results.
Its expected context is supplied by an authenticated caller; validation is not authentication.
The existing invoker SQL function independently checks permissions and RLS.

Canonical SOC observations now carry the same environment at the top level and in
`source`. Enode output is versioned `enode-soc/2`. Do not silently reinterpret any
persisted version-1 observation. No persisted observation store is introduced here.
An empty candidate list still validates the complete route-selection context.

Enode stays optional. First-party OCPP/OEM/Edge retain Flexexa-owned canonical IDs.
No successful inventory read is consent, a control lease or a physical command.

## Lifecycle proposal — explicitly not implemented as a shared invariant

`docs/proposals/connect-lifecycle-v1.json` preserves the prior 25-edge design for review.
It proposes reconnection through pending and terminal revocation. The current database
only enforces the terminal-revocation invariant at this general registry boundary;
PR10 additionally guards its two specific account operations. The complete proposed
matrix therefore MUST NOT be exported as an already-synchronized kernel/SQL rule.

A follow-up must define repeated-status semantics, reconcile account versus connection
lifecycles, authorization, consent and stale-version checks, introduce a forward-only
migration and run the same matrix through SQL and TypeScript before activation.
Do not reapply the superseded registry SQL proposal or rewrite the ten applied migrations.

## Verification boundary

The existing permanent database job sends actual authenticated Enode and first-party
OCPP route results through the recovered TypeScript reader. Full pinned application
and database CI are still required for this revision. Supplemental local source tests
are not live provider tests, physical-control certification or phase completion.
