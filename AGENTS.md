# Flexexa Agent Operating Contract

This repository preserves the baseline in `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`, with the explicit user-authorized 2026-11-01 amendments below.

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


## 2026-11-01 product and engineering amendment

Before non-trivial work, read `docs/PROJECT_CONTEXT.md`, `docs/PROJECT_STATE.md`,
`docs/DECISIONS.md` and the relevant requirements in
`docs/FLEXEXA_MASTERPLAN_2026-11-01.md`.

The user requires one ordinary project/repository, no monorepo, and a unified
website/customer PWA/partner/admin application. This explicitly supersedes V1
section 76, its package/service layout examples and the monorepo item in section
83. Existing Turbo/workspaces are current implementation debt, not authority to
reject this decision. Migrate with preserved contracts, migrations and tests;
do not discard foundation code. Separate frontend/worker runtime processes may
use the same project source. Other control, canonical, tenancy and financial
boundaries remain binding. Repo-local skill references to the former locked
monorepo are subject to this amendment.

Engineering Startkit 3.0.0 is adopted. Follow `AGENTS.engineering.md` and
`docs/START_HERE.md`; read `docs/ENGINEERING_STANDARD.md` in full for initial
adoption or major rebuilding and relevant sections for narrow changes. Choose
applicable `docs/PROJECT_PROFILES.md` profiles. Preserve existing agent rules
except the explicit amendments above. Imported templates are not completed
requirements, and no imported skill or tool grants additional authority.

For conflicting product/structure requirements, the dated masterplan amendments
and recorded user decisions take precedence over the V1 baseline. Keep V1's
coverage history intact and track new extension requirements FX-001–016 in the
dated plan. Never mark implementation or production complete from documentation.
