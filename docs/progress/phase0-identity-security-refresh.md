# Phase 0 — identity container security refresh

Candidate dated 2026-10-02, part of the runtime maintenance package in PR #52.
The locked V1 §§77 and 83 remain authoritative. This is not Phase 0 acceptance.

## Observed blocker

Run `36980120956`, head `a32e722a6067e807fedf38b3cadd51863b8c8cdd`,
passed application and all six isolated runtime jobs. Database job `110752508633`
passed replay, integration and logical restore, then failed the tested identity image
scan. Artifact `11214718759` (`flexexa-identity-container-scan`) reports two HIGH
findings in `libssl3t64` version `3.5.7-1~deb13u2`: CVE-2026-75804 and
CVE-2026-84782. Its reported fixed version is `3.5.7-1~deb13u3`. Debian DSA-6531-1
independently identifies that fixed Trixie security version.

## Bounded change and publisher metadata

Keep the publisher, Node 24 line, Debian 13 distribution and nonroot variant. Replace
only the immutable runtime base pin with the current publisher index:

- Old index: `sha256:7781e8b4fccf59240bd539af6738cccf8dad4be303165c3a1fa065c48699b937`.
- Candidate index: `sha256:9eeb7f5887d0e239e78264b06f7f11d2e14be534050481803a9e4728fcdd278e`.
- Linux/amd64 child: `sha256:2a2f6eb2687719a49d0662615ffab9b78994a722ad64c508d62f1e24857c4068`.
- Publisher annotation identifies Node `24.21.0`.
- Direct inspection of the child layer `sha256:810e2b405a0884835290e120ef380aa14dd1f53198a0cfa2260147e736d82cd5`
  finds `var/lib/dpkg/status.d/libssl3t64` version `3.5.7-1~deb13u3`.

The layer/package observation is not a signature or whole-image vulnerability result.
CI must verify the selected base using the existing Distroless keyless identity/issuer,
build that digest, execute the real Auth/SQL/container story and scan that tested image.
The production Node patch change also needs those integration checks.

## Review and required evidence

Reviewed direct consumers: the identity Dockerfile, explicit copy allowlist, native
TypeScript entrypoint, production dependency installation, real Auth TLS fixture,
container hardening/health/SIGTERM checks, database workflow, archive scan and hosted
ECS image projection. No workflow, API, SQL, dependency lock, IAM or infrastructure
change is required. UID 65532, direct PID 1, HTTPS, read-only fixture and scan failures
remain enforced. No ignore list, unfixed exclusion or signature bypass is added.

Activated local Docker/local-stack, AWS containers, verification, index/impact,
affected verification, code review, security review and test strategy; applied the
available AWS containers and verification upstream guidance. AWS authentication and
deployment are conditional on a later hosted operation; browser/React and database
schema skills are skipped because their sources are unchanged. Canonical tenant,
authorization, audit, idempotency and migration history must remain intact in the
existing full suite. Impact is HIGH; application-only checks cannot certify runtime.

No Docker daemon is available locally. Final-head CI, retained scan output and actual
PR review are required before merge. Historical green PR #24 evidence does not certify
this candidate. Hosted ECS/ECR deployment, live smoke tests and the remaining foundation
gates are separate work.

Local frozen installation, index/impact and `verify:affected --application-only` passed
with Node 24.19.0 and the pinned pnpm 12.3.4: plan integrity, all 20 PostgreSQL and two
ClickHouse history entries, quality regression tests, lint, typecheck, tests and build.
Unchanged application tasks legitimately reused the workspace cache. The verifier
explicitly leaves the database/Auth/container/protocol security gates pending.

## Primary references checked on 2026-10-02

- https://security-tracker.debian.org/tracker/DSA-6531-1
- https://security-tracker.debian.org/tracker/CVE-2026-84782
- https://github.com/GoogleContainerTools/distroless
- https://gcr.io/v2/distroless/nodejs24-debian13/manifests/nonroot
