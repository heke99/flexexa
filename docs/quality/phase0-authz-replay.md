# Phase 0 authorization replay evidence

## Scope and routing

Supabase/Postgres, private authorization helpers, RLS consumers, role assignment integrity and CI. HIGH risk. Activated skills: supabase, supabase-postgres-best-practices, flexexa-impact-analysis, flexexa-security-review, flexexa-test-strategy, flexexa-affected-verification. No UI changes, physical device commands or market actions.

## Verified source / migration promotion

- PR #2 isolates this change from the concurrent AWS work in #1.
- Initial source head: f437273a4390805cd2286b14da77c2a52573aa88.
- Workflow run 34344622085: isolated Supabase start, clean local migration replay and all 21 pgTAP authorization tests passed. Application verification job also passed.
- Supabase CLI 2.117.0 generated `20260909111600_phase0_authorization_invariants.sql` in the isolated runner. Its body matches the source-controlled proposal (Git blob bd32d6b55e6e1168c74c04cf5157fbc79782bf66).
- After test success, the same SQL body was applied to dev `zhgwlvmtvwjftyjmgljw`; remote migration version is `20260909112319`. The tracked filename uses this actual remote version to prevent future duplicate application. No previous migration was rewritten and no migration history was repaired.
- The generated local configuration is reduced to explicit safe defaults, pinned PostgreSQL 17, disabled signup/anonymous login and enabled TOTP MFA. A second replay validates the committed inputs.

## Invariants tested

Explicit anon helper privileges revoked; private schema not accessible to anon; tenant/platform role scopes enforced; cross-tenant composite foreign keys; positive own-tenant access; negative other-tenant reads and permissions; direct writes denied; unknown permission denied; explicit deny wins; effective-permission list uses the same decision; tenant/organization suspension blocks access; platform actions need aal2; platform membership is not implicit device-control authorization; anonymous sign-ins are not tenant authorization.

## Boundaries

This is not full RBAC completion: custom tenant roles, expiring grants, approval/break-glass sessions, public RPC wrappers, audit/outbox/idempotency and customer-facing APIs remain separate work. The app verification script still lists specialized checks; this new independent database job actually executes replay/pgTAP rather than claiming them from a build result. No claim is made that placeholder application tests prove domain behavior.

Do not run destructive reset commands against remote dev/production. CI uses an isolated disposable Supabase stack; test fixtures are rolled back.
