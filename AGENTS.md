# Flexexa Agent Operating Contract

This repository implements the locked architecture in `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`.

## Before every non-trivial task

1. Read the relevant master-plan section.
2. Read `skills-lock.json`.
3. Inspect the actual implementation, schema, migrations, tests and deployment state.
4. Load all materially relevant repo-local skills from `.agents/skills/`.
5. Record a concise skill-routing note: activated, conditional and intentionally skipped skills.
6. Preserve canonical models, tenant isolation and architecture boundaries.
7. Verify the complete changed flow before reporting completion.

## Installed skill inventory — 18

### Critical
1. `supabase`
2. `supabase-postgres-best-practices`
3. `nextjs`
4. `turborepo`
5. `deployments-cicd`
6. `env-vars`
7. `observability`
8. `vercel-firewall`
9. `verification`
10. `agent-browser-verify`

### High
11. `react-best-practices`
12. `shadcn`
13. `vercel-api`
14. `investigation-mode`
15. `bootstrap` — especially Phase 0/foundation

### Useful / selective
16. `vercel-agent`
17. `routing-middleware`
18. `vercel-flags`

## Routing baseline

Database/Auth/RLS/RPC:
- supabase
- supabase-postgres-best-practices
- verification

Next.js/UI:
- nextjs
- react-best-practices
- shadcn
- agent-browser-verify
- verification

Monorepo/build:
- turborepo
- deployments-cicd
- verification

Vercel operations:
- deployments-cicd
- env-vars
- observability
- vercel-firewall
- vercel-api
- investigation-mode when broken

Tenant domain/routing:
- routing-middleware
- nextjs
- supabase
- verification

Feature rollout:
- vercel-flags only for non-authoritative product/UI rollout
- never for the central Flexexa Rules Engine

PR/incident:
- vercel-agent
- investigation-mode
- verification

## Locked architecture boundaries

- Web apps/frontends: Next.js on Vercel.
- Critical backend/control: AWS ECS/Fargate.
- Transactional source of truth: PostgreSQL/Supabase.
- High-volume telemetry: ClickHouse.
- Event bus: RabbitMQ.
- Hot cache/locks/presence: Valkey.
- Raw/archive/audit payloads: S3.
- Central dynamic business rules: Flexexa Kernel / Policy & Rules Layer.
- Physical safety: deterministic device/Edge/local invariants.
- Flexexa is BRP-aware but is not BRP.

A Vercel skill may not silently replace AWS ECS, RabbitMQ, Valkey, ClickHouse, S3 or the Flexexa Rules Engine because a convenient Vercel alternative exists.

## Canonical tenancy contract

- Every tenant-owned business row has `tenant_id NOT NULL`.
- Same-tenant relationships are enforced with database constraints.
- Exposed tenant data uses RLS plus permission-based RBAC.
- Hostname/slug/frontend state is never sufficient authorization.
- Cross-tenant aggregation uses explicit privileged audited platform paths only.
- Provider payloads terminate at adapter boundaries and normalize into canonical Flexexa models.

## Verification gates

Run all gates relevant to the change:
- lint
- typecheck
- unit tests
- integration tests
- clean migration replay
- RLS tests
- two-tenant negative tests
- RPC/idempotency/concurrency tests
- API contract tests
- Next.js build
- browser/full-story E2E
- security checks

Flex reservations must prove no oversubscription under concurrency.
Settlement/ledger changes must prove idempotency and debit=credit balance.
No phase is complete until its relevant master-plan Definition of Done is green.
