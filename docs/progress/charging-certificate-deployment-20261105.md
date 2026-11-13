# Development API certificate bootstrap

The user's explicit deployment instruction on 2026-11-05 authorizes this one-time
development deployment. This main-only change is deliberately separate from the
larger application branch; it does not merge or overwrite the public website.

Verified application source is pinned to commit
6c39394b78de49b0b987c6ed4550f2f15f6a303b. Its application, clean database/Auth,
container signatures and HIGH/CRITICAL scans passed in GitHub Actions. The new
runtime uses an immutable signed Chainguard Node 26.13.0 image instead of the
blocked Debian zlib package. Application compatibility was exercised in real
containers, including the new network-isolated charging API admission test.

This bootstrap creates only the public DNS-validated ACM certificate for
api-staging.flexexa.com. The existing first-foundation checker stays unchanged.
A separate narrow gate validates the certificate and then requires every existing
foundation resource to be no-op. Replacements, deletions, other domains, imported
private keys, email validation and unrelated resources are rejected.

The one-time workflow runs only on protected current main, only on the explicitly
marked merge commit, and only after checking the exact application's successful
CI runs. IAM uses the existing main-only GitHub OIDC trust. Its separately recorded
bootstrap policy extension grants only the necessary tagged ACM actions in
Stockholm for the named development domain; AWS IAM Access Analyzer returned zero
findings. This identity bootstrap is not a manual application-resource creation.
The ACM resource and its protected existing state are managed by OpenTofu.

Expected merge marker: Deploy reviewed charging API dev certificate 20261105.
No normal unmarked main push starts this apply. The generic foundation apply
workflow is not weakened. No ECR upload, task, service or traffic cutover is
performed by this certificate-only workflow.

The workflow retains DNS validation records and an ACM read-back as artifacts.
Authoritative DNS is external: docks12.rzone.de / shades17.rzone.de (Strato).
The exact emitted CNAME must be installed before ACM can issue the certificate.
DNS credentials are not stored here and no certificate validation is faked.
After issuance, the immutable API image, scoped runtime-role plan and actual
Fargate/ALB health and authenticated/denied API requests still require verification.

Local verification: all 265 deployment-gate regression tests passed; OpenTofu
formatting/parser checks passed. The PR's signed-provider validation and real
read-only AWS plan must pass before merge. The local provider cache rejected its
package checksum; no lock-file checksum was disabled, replaced or bypassed.
