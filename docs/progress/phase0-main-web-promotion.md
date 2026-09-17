# Phase 0 — restore the missing Vercel web root on main

Date: 2026-09-17. Scope: deploying the existing public foundation shell only.

## Observed failure and scope

PR #49 is merged into main as f4541230c8aa5c6ca083f5398078139be1b78904.
Its AWS plan passed; the unrelated Vercel build failed before compilation because
main had no apps/web or root package workspace. The application exists in the
fully tested foundation source 2de68443640de60755bf4b36556753e2491da34d,
merged through PR #48. This projection does not promote the whole foundation.

Copy the exact existing apps/web, shared TypeScript/ESLint/Turbo configuration,
workspace policy and complete dependency lock. The root package keeps identical
runtime constraints and dependencies, but its application commands intentionally
cover only the web workspace present on main. No backend package, SQL, database
migration, control route or AWS service is introduced. The full foundation branch
and its application/database/runtime gates remain authoritative for those areas.

The committed manifest records source commit/tree and exact Git blob identities.
CI validates the actual source Git objects as well as local bytes, and separately
compares the root dependencies. Changing copied source requires an explicit reviewed
new source snapshot, never an untracked hand-edited fork. The full dependency lock
retains upstream importers; only existing workspace packages are installed/built.

## Verification and safety

A dedicated main PR job runs source parity, frozen installation, plan inventory,
codebase indexing, impact analysis, all present web/unit tests, lint, typecheck,
production build and a real loopback production HTTP/JS/CSS/404 smoke test.
Vercel uses the same pinned pnpm installation and exact web build. Both actual
preview deployment and post-merge production readback must be checked before a
hosted web claim. HTTP smoke is not browser interaction, Auth or tenant testing.
The shell does not connect to Supabase, issue credentials or control assets.
No secret environment, raw state, new dependency version or protection bypass.

Activated: nextjs, deployments-cicd, vercel-api, bootstrap, verification,
flexexa-codebase-index, flexexa-impact-analysis, flexexa-affected-verification and
flexexa-security-review. Database/IAM/provider changes are deliberately absent.
Master-plan sections 71, 77 and 83 remain in scope; all source points are preserved
and plan:ready must continue to reject whole-plan completion.

The independent outstanding AWS step remains the existing manual OpenTofu AWS
apply on current protected main with confirm=APPLY_DEV, followed by its strict
zero-drift gate and independent resource readback. Do not add a push-based apply,
weaken the guard or substitute AWS-root state edits for that approved flow.
Hosted services, credentials/approvals, observability, restore/security/load and
remaining Phase 0 acceptance are still separate unfinished gates.
