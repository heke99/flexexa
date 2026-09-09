# Phase 0 — identity administration transport

Scope: continuation after merged PR #15, before privileged Auth provisioning.
The existing enrollment and terminal revocation RPCs now have a session-bound typed
transport. It snapshots tenant/environment from trusted context, validates requests
before I/O, decodes canonical receipts and preserves historical replay correlation.
It reuses the existing sanitized database error mapping and never retries ambiguous
network failures. It accepts no credentials and grants no permissions.

The permanent isolated database runner now sends all 40 concurrent identity calls
through this transport. Existing race outcomes, audit/outbox/idempotency counts and
same-session revocation assertions remain required. No SQL or lockfile changed.

## Skill routing and review
Activated repository codebase-index, impact-analysis, affected-verification,
code-review, security-review, test-strategy and verification. Read Supabase overlays
and upstream security guidance for the existing authorization boundary. SQL/index
changes are conditional and unnecessary here; UI/browser and AWS deployment skills
are skipped because no UI or runtime infrastructure is changed.
Reviewed locked sections 15, 18–20 and 68, canonical RPC/receipt consumers and the
permanent database bridge. Core mutation callers retain the same error semantics.

## Verification
- Local contract suite: 273 passed, including 13 transport regression tests.
- Live development migration history: twelve versions match tracked filenames;
  no migration applied in this change. This is history parity, not a new SQL behavioral test.
- Local full application verification passed lint, typecheck, 402 tests and build.
  Runtime was Node 24.19.0 with the available pnpm 11.19.0; this does not replace
  the pinned pnpm 12.3.4 CI installation gate.
- Verification exits 2 intentionally because clean database replay/RLS and the
  real RPC/concurrency checks remain pending. Docker is unavailable locally.
- Final-head application and isolated database CI must pass before merge.

## Remaining boundary
This does not provision Auth users, issue API credentials, deliver secrets, implement
OAuth/consent or deploy identity-service. The separately privileged provisioning
workflow still needs durable operation/recovery state and server-only credential
custody before it can safely call enrollment. Phase 0 and whole-plan readiness remain
incomplete; all original source points are preserved.
