# Phase 0 country-pack baseline

Scope: locked §§81/83, immutable Swedish metadata structure and preservation of
existing API/SQL defaults. No tax implementation, country expansion or market
qualification claimed. Source: prior canonical core seeds and defaults.

Skill routing: active Supabase/Postgres, verification, codebase index/impact,
affected verification, code/security review, test strategy, Docker and CI overlays.
AWS provisioning and browser/UI skills are conditional and not invoked for this
change: no new IAM, deployed runtime, screens or provider integration.

Risk review: HIGH (API contracts, SQL and workflow). Direct API parsers and all
transitive RPC/Auth/container consumers need full application and isolated database
verification. Root country data and shared TypeScript/ESLint configuration are explicit
Turbo cache inputs; the source-only container includes the same dependency closure.
Immutable historical migrations stay intact. The new helper is
security invoker with a fixed search path and static metadata only; no new tenant
write grants, tenant data or privileged credentials. Nine defaults retain values.

Local application lint/typecheck/tests/build passed; focused pack and source-compiler
regressions passed after the final parser hardening. No third-party dependency or lockfile change.

Candidate run `34461923520` passed both jobs: 502 SQL assertions, five additional
SQL/TypeScript location cases, four price-area checks, all prior contracts and
concurrency, host/container real MFA/provisioning/recovery and image scan.

Development migration `20260910094434` was applied only after candidate CI passed.
Exact SQL readback: 6,202 bytes, SHA256
`f272e7cf87e25991c46fd4586aef8c1210ab723e933d145d59cc636df744b8e9`.
Only the new candidate filename was synchronized to the assigned timestamp.
Fresh history at `2026-09-10T09:45:30Z`: 16 tracked/pinned, no pending migrations,
four unchanged exact historical formatting exceptions. Live catalog and clean
candidate replay: 915 unique application objects, zero differences. Security
advisors: no WARN/ERROR; six existing deny-by-default tables are informational.

Future country-data/compiler edits explicitly require HIGH-risk application,
database replay and RPC/concurrency checks even with a fully resolved import graph.
Final tracked CI and head-locked merge evidence are recorded in PR #25.
Phase 0 remains in progress; no live AWS deployment or later phase is claimed.
