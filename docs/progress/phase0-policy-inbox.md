# Phase 0 transactional policy inbox — verified increment

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

Candidate run `34491487152` passed all six jobs, 635 pgTAP assertions, 16 concurrent
consumes, forced audit-failure rollback, obsolete-version delivery and grant expiry
after a real inbox lock wait. The complete real outbox → RabbitMQ → typed consumer
→ SQL commit → lost ACK → redelivery flow passed; one inbox/audit/effect remained.
The final fixture also gives its quorum queue an explicit delivery limit and DLQ.

Exact development migration `20260910145540` is applied: 31,692 bytes, SHA-256
`a811298ccad01f483385922370691911ba285ff2988346eed6f487c22fe11033`. All 19 migration
entries and 1,322 application catalog objects match the clean replay, zero differences.
The final pinned-source run and final readback/merge evidence are recorded in PR #36.
No hosted worker, general provider inbox or whole Phase 0 completion is claimed.
