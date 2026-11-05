# Charging API runtime deployment continuation

The refreshed Debian distroless runtime still contains the blocked zlib package.
The candidate replacement is the publicly available Chainguard Node image pinned
by OCI index digest ca6e654a852f7efc8ba126df701af3894b92e7100b482f638a6823be4e9bc99b.
Its published image configuration identifies Node 26.13.0-r0 and
zlib 1.3.2.1_rc20260921-r2. Runtime Node advances from 24 to 26; the dependency
installation stage remains pinned Node 24. This change requires actual container
compatibility tests, not an assumption that a newer package is safe.

Signature checking is retained with the vendor's exact documented GitHub OIDC
issuer/identity. CI asserts the runtime Node version, runs the real identity/Auth
container integration, and scans the exact images with unchanged HIGH/CRITICAL
failure gates. A new isolated charging-container job verifies liveness, denial
without a token, nonroot execution and graceful shutdown without network access.
No service-role key or real customer token is used in that smoke test.

The optional OpenTofu charging-api module adds private Fargate tasks, HTTPS ALB,
separate execution/task roles, scoped ECR/log permissions, circuit-breaker rollback,
restricted security groups and NAT egress for Supabase and AWS APIs. It is disabled
by default. It accepts only a digest-pinned image in the existing dev API repository,
a same-account Stockholm ACM certificate and a publishable Supabase key.
It creates billable ALB/NAT/Fargate resources only when explicitly enabled.

No live ECS, ECR image or ACM certificate existed during the read-only inventory.
Normal deployment must follow the protected main/OIDC/OpenTofu path, preserve
existing state and leave the public marketing site unchanged. Before enabling:
verify image signatures/scans/integration, publish the exact image to ECR,
provision/validate ACM/DNS, review the actual enabled plan and IAM scope, then
apply and verify running tasks, target health and authenticated/denied requests.

Local formatting/parser checks passed. Local provider-schema validation was
blocked by an installed-provider checksum mismatch; the existing signed lock
file was not weakened or replaced. Provider validation and the actual AWS plan
remain CI gates. No local apply or manual AWS service mutation was performed.

Source for vendor verification identity:
https://images.chainguard.dev/directory/image/node/provenance
