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

Verification pending: candidate full CI, exact development apply/readback,
fresh migration history/catalog parity and final tracked CI. A local application
pass alone does not complete this step or Phase 0.
