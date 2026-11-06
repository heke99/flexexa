# Live prices and authenticated inventory — 2026-11-05

Continuation of the five-part charging slice. V1 §§35–45,69,78,83;
preparation for V1.1 FXP-04/05. No phase acceptance or physical charging verdict.

## Implemented

- Elpriset just nu adapter with SE1–SE4, current/next Swedish date, full contiguous
  15/60-minute intervals and Stockholm DST boundaries (23/24/25 hours). Public
  price read endpoint `/api/prices?area=SE3&date=YYYY-MM-DD`, five-minute bounded
  cache, request coalescing, timeout, bounded response size and no stale/error
  fallback. Spot prices exclude VAT, retailer charges, grid charges and energy tax.
- `/prices` shows actual published prices, source and retrieval timestamp. Missing
  tomorrow prices do not become guessed/zero values. This Vercel read/BFF surface
  does not execute optimization or control commands.
- Python `spot_price_input.py` consumes that canonical normalized price contract
  with expected area/date, explicit freshness, separate tariff inputs and supplied
  headroom. Missing headroom remains unknown. Verified a 96-interval SE3 source
  snapshot from 2026-11-05 through normalization and MILP: optimal 1.3800 kWh for
  a synthetic vehicle/tariff/headroom replay. No physical saving is demonstrated.
- `/portal` uses Supabase Auth password login, in-memory session/refresh, logout,
  MFA enrollment (QR shown only to the signed-in user) and verification using a TOTP factor, company selection and
  strict live asset inventory. It cannot invent a live plan/cost when none exists.
  It uses the caller's JWT for the canonical database RPC. No service-role key.
  Auth changes invalidate displayed company/admin state and pending data results.
- New database read RPCs check a live, nonanonymous human session and current
  tenant permissions. Invoker reads retain asset RLS. Platform aggregation requires
  the existing locked live MFA/platform authority and atomically writes canonical
  receipt + audit. No role assignments or customer records were created.
- AWS HTTP adapter now has actual caller-JWT Supabase transport, strict inventory
  contracts, runtime entry point and a pinned nonroot container definition. Container
  build/runtime remains unverified here; the executor has no Docker. No ECS service
  was created and no critical control moved to Vercel or Supabase.

## Verification and observed environment

Eleven pgTAP assertions passed in rolled-back two-tenant fixtures on flexexa-dev:
anonymous denial, own/foreign assets, company selector, cross-tenant denial,
company/platform separation, MFA, aggregate output, audit and expired session.
The two additive migrations were then applied and their local filenames aligned
with the versions recorded by Supabase. Existing acquisition migrations are a
separate live history and were preserved. No claim of a clean full replay follows
from those tests; CI must still establish that independently.

AWS account/cluster verified: flexexa-dev eu-north-1 has no services. The connected
AWS principal is root; the existing least-privilege deployment path is GitHub OIDC
plus reviewed OpenTofu/main. No root-created task role/service, state bypass or
unreviewed infrastructure apply was used. ECS/ALB/DNS/certificate/runtime roles and
deployment must still be implemented/reviewed through that path.

Development DB initially had zero tenants and one existing Auth user. The portal
therefore cannot be shown as populated with real vehicles. No existing user was
silently granted platform access. Positive end-user Auth/MFA/browser validation
requires a real authorized session; SQL fixtures do not prove that flow.

Existing security-advisor findings on the acquisition endpoint and password-leak
protection were observed, not silently changed. RPC-only private/receipt tables
retain default-deny RLS. Relevant notices: Supabase database linter 0028/0029 and
https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

Review routing: Supabase/Postgres, Next.js/React, index/impact, code/security review,
test strategy, verification, environment configuration and deployment. AWS was
read-only plus container preparation; no IaC/apply scope changed.

## Still required

Durable goal/plan storage and policy integration; live device telemetry and scoped
consent/session/capability checks; tariff onboarding and demand-charge model;
fenced dispatch/local safety; ECS runtime and authenticated external partner API;
BMW/charger capability verification and physical pilot. Price access does not
establish a car connection, retail tariff, BSP route or control permission.
