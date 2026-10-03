# Phase 0 — bounded identity HTTP receive time

Date: 2026-10-03. Scope: V1 §§71–73, 77, 83 and the HTTP availability
portion of FXP-01-T3. Prerequisites: #51, #53 and #54. This package does not
complete the hosted operations case, issue credentials or accept Phase 0.

## Reproduced failure and correction

The identity server declared ten-second request/header receive timeouts but used
Node's default thirty-second incomplete-connection checking interval. Eight
incomplete authenticated-looking uploads could therefore retain every business
admission slot beyond the declared budget. Headers are not authentication; no
upstream authority is consulted until the complete canonical request is validated.

A regression opens real TCP/HTTP connections: one incomplete header and eight
incomplete bodies. Continuous trickled bytes must not renew the absolute receive
deadline. It verifies saturation returns the existing 503 UNAVAILABLE, liveness
continues, all incomplete requests receive HTTP 408 and close, all eight admission
slots recover, diagnostics omit the fixed test credential and no upstream call
occurs. It failed before the correction at the 13.5-second observation bound.

Set the unchanged ten-second receive budgets when creating the server, together
with a one-second connection checking interval. The regression then passed with
closure around eleven seconds. This is a periodic receive deadline, not an exact
ten-second wall-clock guarantee or an idle timer. Node's built-in 408/connection
closure remains the transport behavior; it is not a new canonical error code.
Completed request bodies retain the existing transaction/lease/idempotency and
ambiguous-result recovery paths. Existing readiness, draining and process signal
regressions also pass. No runtime timeout override is exposed to callers.

Primary runtime reference, checked 2026-10-03:
https://nodejs.org/docs/latest-v24.x/api/http.html#httpcreateserveroptions-requestlistener

## Validation and reviewed consumers

Activated repo codebase-index, impact-analysis, affected-verification, code-review,
security-review, test-strategy, Docker/local-stack and full-story verification.
Story: real incomplete HTTP request → bounded receive/close → slot reclamation →
new canonical validation, without an upstream side effect. Reviewed consumers:
server/main, body parser, eight-request admission, readiness/drain, per-request
diagnostics/telemetry, native process tests and the hardened container fixture.
Database/schema, canonical models, providers, IAM, dependencies, images and browser
mutations are intentionally outside the implementation change.

Pinned pnpm 12.3.4, Node 24.19.0: frozen installation passed; the eleven focused
HTTP/readiness/diagnostic tests passed. HIGH-impact affected verification passed
all application lint/typecheck/tests/build, including 138 quality tests and 51
identity tests. It correctly returned exit 2 for the separately required real
database/RPC/Auth/container gates; no full verification is inferred from that run.
No local Docker daemon. Ordinary final-head CI, actual source review and prerequisite
merges remain required. Neither FXP-01 nor its operations case is marked verified.

## Current independent readback

Read-only development observations on 2026-10-03, separate from runtime acceptance:

- At 18:12 UTC AWS eu-north-1 has the OpenTofu-tagged flexexa-dev VPC and ACTIVE
  ECS cluster with Container Insights enabled. The cluster has zero running or
  pending tasks, zero active services and an empty service listing. Resource
  presence does not establish converged IaC or a deployed identity backend.
- The only manual apply run returned by the repository's workflow-dispatch run
  collection is 35195030570, conclusion failure. The reviewed main-only apply
  still requires rerun and zero-drift evidence. The GitHub connector exposes no
  workflow-dispatch mutation; no alternate AWS write path was used.
- Development project zhgwlvmtvwjftyjmgljw: fresh migration snapshot captured
  18:16:03 UTC passed the existing strict checker for all 20 pinned entries,
  including the four explicitly reviewed historical formatting exceptions, with
  no pending migration. All 39 public tables have RLS enabled. This count is not
  an authorization-policy or live Auth acceptance test.
- The fresh application catalog has 1,338 objects. It was compared against the
  clean replay artifact 11221710585 from successful run 36995706757 at source
  60c47a8a121c14f9e53b12759f367e3306ab8f65. Downloaded ZIP SHA-256 is
  bb373cc2952fd096453d2d87bc92aee726b90b783c0f8183e834e6d468ed154d,
  matching GitHub. No SQL, migration or catalog-query bytes differ from that
  source in this package. The strict comparison reported zero differences.
  This covers the application catalog; hosted Auth, row data, globals and runtime
  infrastructure are separate acceptance boundaries.

Keep the full V1/V1.1 roadmap and all phase exit requirements. Hosted credential
lifecycle/approvals, policy binding/signing, worker deployment, alerts and recovery
remain foundation work. Physical charging and partner acceptance retain their
Phase 1 and Phase 5 boundaries. The aggregate foundation PR must not be promoted
to main from this isolated HTTP or schema result.
