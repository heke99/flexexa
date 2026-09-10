# Isolated OpenTelemetry Collector

Linux loopback sidecar protocol verification. Run the tracked fixture with
`ALLOW_ISOLATED_RUNTIME_TESTS=1 node --experimental-strip-types scripts/runtime/verify-otel.mjs`
after a frozen production install of the identity service dependencies.

All receiver, health, self-metric and destination endpoints are fixed to IPv4 loopback,
with required ephemeral port variables. The host network is used only to share this
loopback namespace with the SDK and test destination. No Docker port is published.
The test also checks that all three listeners are inaccessible on the host's external
IPv4 address. This is not an externally exposed or tenant-authenticated ingestion API.
A future hosted topology needs explicit trust, TLS and network policy verification.

The unmodified official Collector image runs as UID 65532, read-only, without Linux
capabilities or writable data mounts, under CPU/memory/PID limits. Its scratch image
has no shell or HTTP client: the fixture polls the actual health HTTP endpoint before
starting any dependent SDK and again after restart. Configuration validation is a
separate preflight, not a substitute for runtime health.

Only traces are enabled. An in-memory limiter and batch processor precede an OTLP HTTP
exporter with one worker, queue of 64 requests, one-second timeout and bounded retries.
Delivery is best effort: full queues, sustained destination outages, crash/restart or
memory pressure may discard spans. No durable delivery, tenant telemetry storage,
Grafana dashboard, business metrics or AWS deployment is claimed. Prometheus-compatible
Collector self-metrics are verified; high-volume canonical asset telemetry remains in
ClickHouse and is not redirected here. No debug payload exporter is configured.

Current official references: [release](https://github.com/open-telemetry/opentelemetry-collector-releases/releases/tag/v0.160.0),
[configuration](https://opentelemetry.io/docs/collector/configuration/),
[OTLP HTTP exporter](https://github.com/open-telemetry/opentelemetry-collector/blob/v0.160.0/exporter/otlphttpexporter/README.md).

Candidate version is resolved in CI and must be frozen to its observed registry digest
before the final scan/merge. No guessed image digest is accepted.
