# RabbitMQ OpenSSL pin refresh — 2026-10-02

Scope: locked V1 sections 31/77/83, isolated RabbitMQ image and runtime evidence.
PR #51 candidate 4b4563a4b177b81acbb88651272294db5925081d failed job
110749427129 in run 36979134854 before AMQP tests: apk could not install the
exact libcrypto3/libssl3 3.5.8-r0 pins. The captured diagnostic exposes only the
Docker build exit, not the underlying package selector; package-index rotation
is the evidence-backed cause to test, not a fabricated complete build log.

The publisher OCI index at the existing sha256:3486d98205df3d6395ed70e7924baa13b561cbac54116c0ddae5b0b7382bbabd
identifies Alpine 3.23 and amd64 child sha256:af84b2f925cf031ebea4fb811c9c7515106b0b28f4c099f079632300fd0a5fef.
The official Alpine x86_64 package pages and main index, read 2026-10-02,
provide both packages at 3.5.9-r0 (packaging commit
adcf4978067013c3c0917e54542f3b762d7bfc48). Keep exact pins and signed
Alpine package verification; no edge repository, floating upgrade or scan exclusion.

Sources:
- https://pkgs.alpinelinux.org/package/v3.23/main/x86_64/libcrypto3
- https://pkgs.alpinelinux.org/package/v3.23/main/x86_64/libssl3
- https://dl-cdn.alpinelinux.org/alpine/v3.23/main/x86_64/

Consumers reviewed: isolated AMQP verification, database outbox/inbox round trips,
Compose image build, image scan and uploaded runtime JSON. Base digest, RabbitMQ
version, credentials, tenant/vhost isolation, hardening, persistence and topology
are unchanged. Runtime acceptance now asserts and records both installed versions.
Two source regressions failed before the patch. They are guardrails, not Docker
execution or AMQP/security evidence. A local Docker daemon is unavailable.

Activated: RabbitMQ, Docker-local-stack, index/impact/affected-verification,
code/security review, test-strategy and verification. AWS/IAM/Supabase mutations,
provider/device work and the plan addendum are intentionally excluded. Preserve
the separate PR #51 scope and all historical PostgreSQL/ClickHouse migrations.
Ordinary final-head application/database/AMQP and HIGH/CRITICAL image/client scans
must pass and actual artifacts/reviews must be inspected before merge. No hosted
deployment, physical control, market access or Phase 0 completion is claimed.
