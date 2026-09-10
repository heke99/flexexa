# Phase 0 — identity runtime container

Candidate builds the existing identity backend from an explicit source allowlist. The
Distroless Node 24 / Debian 13 image contains only the service, canonical domain and API
contract sources/manifests plus fixed workspace symlinks. There is no package install,
compiler, copied lockfile, test fixture or application secret in the build context.
The runtime has no shell, npm, yarn, Perl or distribution package manager. The previous
bookworm-slim candidate was rejected after Trivy reported 64 HIGH/CRITICAL package
findings (26 distinct CVEs); unused vulnerable tools are removed by changing the actual
runtime distribution, not by an ignore list or deleting scanner metadata.

The Dockerfile runs as UID/GID `65532`, exposes process liveness, and directly executes the
production Node entrypoint as PID 1. Isolated verification additionally enforces a
read-only root filesystem, no Linux capabilities, no privilege escalation and bounded
memory/CPU. The actual production HTTPS requirement remains enabled. An ephemeral
loopback TLS proxy with a disposable trusted test certificate forwards to local Supabase;
no `NODE_TLS_REJECT_UNAUTHORIZED` bypass or runtime HTTP toggle is introduced.

The existing real MFA/three-subject/ambiguity/concurrency/revocation story runs both on
the host and through the container. The proxy observes real Auth operations and simulates
the one lost response after a real commit. It does not substitute Auth/SQL results.
Disposable local credentials are passed through a mode-0600 temporary env file, kept
outside the repository and image, and removed with the fixture. Only the public test
certificate is mounted. Docker inspection output never includes runtime environment.
The fixture verifies Docker health, non-root UID, read-only root and clean SIGTERM exit.

CI verifies the base image signature against the published Distroless identity/issuer
using Cosign 3.1.3 and builds the resolved digest. The reviewed digest is pinned before
merge. CI scans the tested image archive using digest-pinned Trivy 0.74.0, retains a JSON report and
fails on HIGH/CRITICAL vulnerabilities, including unfixed findings. No ignore policy is
added. Image scanning needs registry/advisory access and remains a real required gate.
No Docker daemon is available in the editing workspace; container results must come
from CI before this boundary is called verified.

Activated repository Docker/local-stack, AWS containers, deployment, verification,
index/impact, code/security review and test strategy. Master sections 77 and 83 apply.
OpenTofu remains infrastructure authority; this change provisions no AWS resource.

References checked:
- https://github.com/GoogleContainerTools/distroless
- https://github.com/sigstore/cosign/releases/tag/v3.1.3
- https://github.com/aquasecurity/trivy/releases/tag/v0.74.0
- https://trivy.dev/docs/latest/references/configuration/cli/trivy_image/

Remaining: ECR publishing, least-privilege ECS runtime/secrets binding, private egress,
TLS ingress, distributed rate limiting, observability, deployment rollback and live
smoke verification. A green isolated container does not complete Phase 0 or deploy AWS.
