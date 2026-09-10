# Phase 0 — session-authorized identity execution coordination

Follows merged PR #17 (`ecb82b7cd19cd9cc31aa05d2ab5648f33bda1bbf`). Its final
tracked run `34445226936` passed application and database gates.

## Bounded behavior
The original provisioning requester can acquire a maximum 30-second lease using
a current MFA session and current api_clients.manage authorization. Another tenant,
administrator, session or environment cannot adopt an attempt. A request-row lock
serializes contenders. An active same-key retry preserves the original lease and
correlation; another key cannot overlap it. After expiry a new key obtains a strictly
higher generation and retains the request's reserved Auth UUID. Historical keys
cannot reacquire authority. Attempts are append-only, with atomic canonical receipts,
audit and outbox evidence. No browser table grants or anonymous RPC access.

The check RPC revalidates requester/session, current client state, intent expiry,
lease expiry and latest generation. Its answer is valid at that transaction only.
Any future finalization must check the fence within its own write transaction.
Session/client temporal validity is checked after potentially waiting on row locks.

## Explicit integration limits
This is database coordination, not a running worker or credential issuer. Supabase
Auth does not enforce this generation number; a database lease cannot cancel a
remote call already in flight. The future privileged service must reconcile only
the reserved UUID after uncertain outcomes, protect credentials, and reauthorize
enrollment. Never adopt by email, issue a second UUID after timeout, use an outbox
event as authority, or treat a saved lease response as a bearer token. No Auth calls,
credentials, bindings, permissions, provider actions or infrastructure are created.
No release/renew/finalization API is claimed by this step.

## Verification and routing
Activated Supabase/Postgres, verification, index/impact/affected verification,
code/security review and test strategy. Reviewed master sections 18–20 and existing
ADR-0004/intent/identity boundaries. Browser, AWS deployment and provider skills
are intentionally skipped for this database-only step. No dependencies changed.
All thirteen earlier migration files remain unchanged.

Application verification passed locally. New PostgreSQL cases cover MFA, tenant,
actor/session/environment isolation, revocation, expiry, immutability, generation
fencing and atomic evidence. The permanent isolated runner adds 24 real concurrent
lease calls while retaining all previous tests. Clean tracked CI and exact dev
read-back remain required before merge; this document does not claim them yet.

## Historical SQL audit
Read-back of all thirteen existing development migrations found nine byte-identical
files, including PR #17. Versions 20260909104034, 20260909104116, 20260909104210 and
20260909112319 differ in whitespace or comments. A token comparison preserving
quoted strings/identifiers matched all four (2038, 1700, 1211, 1179 tokens).
This is a source-formatting investigation, not a general proof of live schema
equivalence. Historical SQL and database history were not rewritten.
