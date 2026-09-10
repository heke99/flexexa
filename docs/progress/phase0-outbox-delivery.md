# Phase 0 — environment-bound outbox delivery

Implements a delivery boundary for the existing immutable transactional outbox.
This is not completed Phase 0, a hosted worker, a consumer inbox, rule publication,
or permission to execute a physical command.

## Scope and invariants

- Existing transaction writers and event facts are unchanged. Only events with an
  explicit `payload_json.environment` equal to the service environment are eligible.
  Unclassified older core events remain pending; no environment is guessed or backfilled.
- A dedicated `events.publish` permission has no automatic grants. Only a currently
  bound service principal with a live session and exact tenant/environment grant can
  claim or finish. Humans, API clients and universal key claims cannot use this path.
  Service provisioning/credential rotation remains a separate outstanding gate.
- Authorization locks Auth user/session, principal, tenant/organization, service,
  permission and grant. Wall-clock expiry is rechecked after event lock waits.
- One row is claimed using `FOR UPDATE SKIP LOCKED`. Append-only attempts have
  server-generated UUIDs, monotonically increasing generations and 30-second expiry.
  Completion is session-bound, reauthorizes, and rejects expired/replaced attempts.
- Durable completion results make repeated acknowledgements idempotent and reject
  conflicting outcomes. Exponential retry delay is bounded at 300 seconds; the tenth
  failure or an expired tenth attempt becomes `dead_letter`. No automatic destructive
  purge or reopening of terminal business facts is provided.
- The delivery coordinator serializes a validated canonical envelope before I/O and
  acknowledges only after the adapter resolves a mandatory persistent broker confirm.
  A failed database acknowledgement never triggers a contradictory retry in that call.
  Delivery is at least once: broker confirmation and PostgreSQL are not one transaction.
  Consumers still require transactional inbox deduplication before business effects.

## Verification

Unit tests cover canonical identity, broker failure, missing confirmation response,
wrong tenant/environment, invalid generation/expiry and substituted receipts. SQL tests
cover scope/session/grant revocation, retained facts, expiry, reclamation and retry limits.
The isolated CI integration uses real PostgreSQL and RabbitMQ with the hash-locked Pika
client: 16 simultaneous claims, 16 identical completion calls, persistent mandatory
broker confirmation and recovery after an interrupted acknowledgement call.

Candidate SQL is replayed and tested in isolated CI before development application.
Final applied migration version/hash, fresh schema parity and exact final CI head belong
in the PR evidence. Do not infer live synchronization from this document alone.

## Skill routing

Activated: Supabase, Postgres best practices, verification, codebase index, impact,
affected verification, code/security review, test strategy, performance review,
RabbitMQ, Docker local stack, monorepo/CI overlays. AWS deployment skills are conditional
on infrastructure work. UI/browser and provider adapters are skipped for this change.

References: locked master §§13, 70, 78–84; [PostgreSQL locking](https://www.postgresql.org/docs/17/explicit-locking.html),
[Supabase function privileges](https://supabase.com/docs/guides/database/functions).

## Development synchronization

Candidate run `34481259184` passed all six jobs, 550 SQL assertions and the real
PostgreSQL/RabbitMQ integration. Development applied `20260910131811`, 11,724 bytes,
SHA-256 `a809b4e5281d590070a874632502d4911b1ae6eff163cd5fc908517140b1a8b3`.
Readback at 2026-09-10 13:18:28 UTC matched all 17 migrations and all 960 application
catalog objects against clean replay, with zero schema differences. Final tracked
filename/hash CI and merge evidence are recorded in PR #34.
