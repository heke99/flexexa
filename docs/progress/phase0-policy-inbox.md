# Phase 0 transactional policy inbox — candidate

Scope: locked §§14, 20, 31 and Phase 0 transactional event handling. The checked
consumer compares the entire received envelope with the immutable canonical outbox
fact, verifies tenant/environment and current service/session/grant, then commits the
readiness effect, audit, causal follow-up outbox event, idempotency receipt and inbox row in one PostgreSQL transaction.
The consumer key is fixed to `policy_readiness.v1`; this is not an arbitrary handler API.

A shared private event-worker assertion retains the existing publisher authorization
and adds separate `events.consume` permission. No service, API client or role template
receives it automatically. Public entrypoints remain invokers; table writes and internal
authorization helpers remain private. API clients and human admins cannot act as workers.

Duplicate deliveries share the durable inbox result even across worker sessions. A
late event for a superseded version records that outcome and cannot change the newer
version's pending readiness. Sandbox readiness retains SANDBOX_ONLY. This handler
cannot publish policies, issue credentials or authorize physical control/production.

New publication events use the locked `policy.version.published` name. Previously
emitted immutable `flexexa.policy.published` sandbox facts remain accepted as a narrow
compatibility path. An explicit forward replacement changes the emitter; the applied
registry migration and existing events are never rewritten.

The typed consumer acknowledges the exact broker delivery only after the database
commits and its response matches the event/scope. Lost commit responses and lost broker
ACKs leave recovery to bounded redelivery and durable deduplication. No exactly-once
external side effects or hosted worker are claimed.

Skill routing: Supabase/Postgres, RabbitMQ/Docker, event contracts, verification,
codebase index/impact/affected verification, code/security/performance review and test
strategy are active. Runtime CI uses the existing pinned RabbitMQ/Pika; no dependency
or credential changes. Browser/provider/AWS deployment are outside this increment.

Pending checks: full application/runtime CI, clean replay, RLS/two-tenant tests, forced
audit failure rollback, 16 concurrent consumes, stale-version delivery and the real
outbox → broker → typed consumer → SQL commit → lost ACK → redelivery flow. The
migration is not applied until the candidate is green; then exact history/catalog
synchronization and a final pinned-source run are required before merging.
