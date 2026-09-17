# Phase 0 — tenant-owned roles and temporal permissions

## Evidence (2026-09-09)
- Reviewed PR #6 source head: `0d06f3d4f681d8f0209392f05655fb2ffe4aaa88`.
- Run `34352876801`, database job `102470196861`: clean isolated Supabase replay, **105 pgTAP assertions PASS** across four files.
- Reviewed SQL SHA-256: `42d8ba2dbc940f59baef1bb58bb3a427185f8d43207f9b5626a658ce465591d1`.
- The same SQL was applied to the empty Stockholm `flexexa-dev` database. Its migration API assigned version `20260909131159`; the committed filename uses that exact version.
- Remote recorded SQL checksum matches the reviewed artifact byte-for-byte. No migration history was rewritten.
- Read-back: 58 active permissions, nine role templates, two platform roles, three temporal exclusion guards, API-client secret hash not selectable by authenticated users, and no tenant/customer data created.
- Security advisors: zero findings after promotion.

## Final gate
The proposal-generation step is removed. A new CI run must replay only tracked migrations and pass before PR #6 is merged. Application verification on this branch still contains legacy placeholder tests; PR #4 owns their replacement. A green application job here is not evidence of full Phase 0 completion.

## Skill routing
Activated: Supabase, Postgres best practices, codebase index, impact analysis, security/code review, test strategy and verification. Browser/UI and AWS runtime skills are not activated for this migration-only promotion; no production or AWS resources are changed.

## Next
Synchronize PR #4 against the promoted schema. Then implement transactional RPC + audit/outbox/idempotency and provider-neutral Flexexa Connect. Enode must remain an adapter alongside first-party connections; customer/site/asset identity belongs to Flexexa.
