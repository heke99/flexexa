# Runtime checks after live-price publication

The 39664c4 application quality job passed. The larger database workflow exposed
one missing optimizer dependency installation in its separate application job.
Both application jobs now install the same hash-locked CPython 3.12 solver wheels.

The same run completed clean migration replay and all 19 pgTAP files: 885 tests,
including the new charging session/RLS/audit tests. Atomic core/RPC concurrency,
identity container execution and restore checks also ran before the image scan
failed. Those facts are scoped to that commit; the entire workflow was not green.

Image scan artifacts identified old Go stdlib and x/net versions in Collector
images and zlib in the identity runtime. No CVE exclusions or failing scanners
were removed. Updates proposed:

- custom Collector build: Go 1.27.3, official archive SHA-256 checked locally;
  x/net v0.60.0 and its transitive crypto/sys/term/text patch levels, generated
  go.sum checksums; `go mod verify` passed;
- OTLP protocol fixture: official Collector 0.164.0 pinned by registry digest;
- identity and charging runtime: refreshed signed distroless Node 24 digest;
  existing Cosign issuer/identity verification preserved; updated pinned Node
  24.22.1 Alpine dependency-build stage does not change the runtime distribution.

Manifest digests were retrieved from the official registries. Image builds,
protocol recovery tests and fresh HIGH/CRITICAL scans must establish whether
all reported image findings are resolved. A newer digest alone is no proof of
remediation, especially where the original scan lists no vendor fixed version.
No production promotion or ECS apply is authorized by a failing scanner.

The private portal now provides TOTP enrollment and uses a direct link from the
price page to the real login surface. QR/factor secrets are not written to logs,
repository or browser storage. Real user MFA enrollment/sign-in remains a human
account step; public preview/browser inspection does not attest it.
