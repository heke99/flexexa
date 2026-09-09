# Atomic core creation boundary

Scope: create customer, site, metering point and asset only. The narrow DTOs in `@flexexa/api-contracts` match the SQL normalization contract. Additional V1 contact/address/edit/transfer features remain separate reviewed operations; no generic JSON-to-table writes are exposed.

Public wrappers are SECURITY INVOKER. One whitelisted private SECURITY DEFINER dispatcher reauthorizes the JWT actor and tenant/permission on every call, including retries. The client cannot supply an actor, status or `controllable` flag. Parent relationships are constrained by composite FKs and explicit active-parent checks; registration does not activate physical control.

The receipt key includes tenant, authenticated actor type/id, operation and idempotency key. Payload JSON is normalized and SHA-256 hashed without correlation metadata. A repeated equal operation returns the original receipt/correlation. Different content with the same scoped key fails. Expiry never silently makes a successful key reusable. Each new creation, receipt completion, append-only audit and outbox insertion occur in one transaction; any failure rolls everything back. No external side effect occurs inside the database transaction.

The conflict loser performs a new SELECT after INSERT ON CONFLICT so READ COMMITTED observes the winner. Higher isolation can still raise serialization errors; API/services must retry whole transactions, not partially repeat side effects. Authorizations are server-evaluated per operation, not cached across requests. This is not the future high-risk control/market policy gate or service-client authentication implementation.

Audit/outbox contain references rather than customer PII. Actor/resource identifiers deliberately survive user/business-record deletion for evidence retention. Dependent customer/site/asset rows use explicit restrictions rather than orphaning. Retention/pseudonymization and controlled purge require a dedicated audited design.

Verification layers:
1. Existing 105 pgTAP assertions remain intact.
2. Core RPC pgTAP tests cover ACL, direct-write denial, ownership, idempotency, normalization, parent state, rollback, append-only evidence and deletion restrictions.
3. 82 exact fixtures run against both TypeScript and SQL normalizers; invalid IANA timezone is rejected by the runtime's authoritative timezone catalog.
4. Disposable-loopback-only Python/psql test runs 32 genuinely concurrent calls: identical duplicates and conflicting payloads. Counts must be exactly two customers, receipts, audits and outbox events, with no unfinished receipt.
5. Pinned application CI must pass lint/typecheck/test/build. The temporary proposal migration must be promoted with its exact tested contents, removed from proposal materialization, and replayed again from tracked migrations before merge.

Unicode text lengths now count scalar values in both languages; unpaired JavaScript surrogates are rejected. UUIDs and decimal strings explicitly reject the final-newline regular-expression loophole. No numerical rounding is used to accept out-of-contract power values.

Not included: update/archive/purge endpoints, service identity sessions, broker publication/ack, command control, full custom rules or production deployment.

## Skill routing
Activated: Supabase/Postgres best practices, canonical contract review, codebase index, change-impact analysis, security review, test strategy and verification. UI/browser, AWS runtime apply and live provider-command skills are intentionally deferred: this change adds no UI, runtime resources or physical control. Provider architecture is governed by ADR-0001 before adapter implementation.
