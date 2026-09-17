# Phase 0 provider-account lifecycle

Base: PR #9 merge `2cf62efcaef10ead9a47dc37791addee7227c113`.
Scope: authenticated pending inventory registration and terminal local revocation.
This is NOT OAuth linking, user consent, service-client authentication or physical control.

## Canonical ownership
- `integrations.manage` is checked independently in the database, including receipt replays.
- Required tenant/customer/provider/environment; no implicit Enode or production default.
- Registration permits known suspended providers but creates only `pending` accounts.
- Browser input cannot supply credentials, external account IDs, health or connected state.
- Revocation locks the account, records bounded reason and prevents future local authority.
- It does NOT claim upstream token cleanup, stopping charging, or rewriting connection history.
- Receipts are historical facts: retrying registration after revocation returns the original
  registration receipt, not a fresh assertion that the account is connected.
- No alternate receipt, audit or outbox store; existing atomic core tables are reused.

## Verification gates
- 62 independently specified payload fixtures are shared by TypeScript and SQL tests.
- 45 new pgTAP assertions cover ownership, environment, rights, immutable history and atomic evidence.
- 48 concurrent RPC calls exercise same-key replay, conflicting registration payloads and
  same/different-key revocation; expected two accounts and four receipts/audits/outbox facts.
- Local supplemental tests are not pinned CI evidence.
- Proposal SQL is tested in disposable loopback Supabase before development promotion.
- Permanent tracked-only replay is not weakened: it remains red until the tested migration
  is committed under the authoritative remote version and the temporary workflow is removed.
- Keep the PR draft until final frozen application build, tracked replay, contract/concurrency
  tests and development read-back pass. Never rewrite the nine applied migrations.

Next: consent/link/discovery transactions and authenticated provider event ingestion, then
safe device shadow/control. Enode and direct OCPP/OEM paths use the same canonical ownership.

## Executed proposal and development evidence
- Source head `c0b7e9a42101779f5ab64788fa3e1ac7222cb38d`.
- Pinned application job `102538686598`, run `34373010841`: SUCCESS.
- Isolated proposal job `102538686862`, run `34373011041`: all migration replay,
  PostgreSQL tests and core/registry/account concurrency checks passed.
- CLI generated `20260909155147_phase0_provider_account_lifecycle.sql` during testing.
- Reviewed artifact `10112779761` exactly matched all 8,512 SQL bytes; SHA256
  `e2bd33a61de22d7e41a04f02eb695ecb9d72954dab41875fc22189a857c5738e`.
- Applied that exact SQL to Stockholm development. Supabase assigned authoritative
  version `20260909155618`; fresh read-back matched byte length and SHA256.
- Live catalog read-back: two public invoker wrappers, one guarded private definer;
  all four functions have empty search_path; anonymous EXECUTE denied on all four;
  internal normalizer also denied to authenticated callers.
- Post-change security advisor has no WARN/ERROR; the same two INFO notices for
  intentionally private receipt/outbox tables remain. Do not add browser policies.
- No business fixtures or provider HTTP calls executed in development.
- Temporary proposal workflow/SQL removed. All ten tracked migrations and permanent
  contract/concurrency gates must pass on the final head. Final result is recorded in PR #10.

Skills: Supabase, Postgres best practices, codebase index/impact, security review and
verification. No UI behavior, AWS runtime or external provider transport changed.
