# Isolated ClickHouse telemetry foundation

Run `ALLOW_ISOLATED_RUNTIME_TESTS=1 python3 scripts/runtime/clickhouse/verify.py`
with Docker Compose available. The Python standard-library runner creates a unique
project, ephemeral credentials and named data volume, then removes them in `finally`.
It never connects to an existing database or ingests customer/device data.

The publisher's distroless 26.8.2.7 image is digest pinned. Runtime UID 101, a read-only
root, no added capabilities, no privilege escalation and bounded resources are tested.
Only a dynamic HTTP port on host 127.0.0.1 is exposed; native health queries remain
inside the container. Health has a loopback-only read account; the default user is
absent. Random fixture admin/reader credentials are not stored in Git or logged.
The test admin is a disposable bootstrap identity, not an application account.

`infra/clickhouse/migrations/0001_telemetry_v1.sql` is the forward schema source.
The application gate compares exact historical migration bytes with its target Git
base: removal, rewrite, duplicate version and backdated additions fail. CI executes
each migration in order and records SHA-256 hashes of the actual SQL inputs. Each
file currently contains one SQL statement. This is source/replay synchronization,
not a claim of a deployed ClickHouse catalog or migration ledger.
It contains locked §30 fields, UUID attribution, UTC millisecond timestamps, one
typed value per sample and explicit units/source/quality. Monthly partitions and
tenant/asset/metric/time ordering support bounded asset-series queries. Values are
Float64 analytics, never authoritative monetary or settlement amounts.

Raw retention v1 is 30 days from event time for this isolated development baseline.
Expired rows are tested with a forced merge; normal TTL deletion is asynchronous.
No aggregate tables or aggregate retention are activated. Production retention needs
the versioned country/tenant privacy policy and archive/restore checks before use.

Two read accounts have table SELECT only and tenant row policies. A reader with no
matching policy sees no rows. Tenant inserts and DDL are denied. This matters because
ClickHouse row policies protect reads, not writes: only a trusted canonical ingestion
service may insert once its Postgres ownership checks are implemented. UUID columns
are not cross-database foreign keys. This fixture does not prove live identity mapping,
inbox deduplication, pipeline integration, HA, TLS, backup/restore or AWS deployment.
Provider identifiers reference the canonical provider registry, not external IDs.

CI executes real insert/query/denial/retention/restart checks and scans the exact image
for HIGH/CRITICAL findings. Package scanning cannot certify every component of the
statically linked ClickHouse binary; publisher security review is a separate gate.

References checked 2026-09-10:
- https://github.com/ClickHouse/ClickHouse/blob/master/docker/server/Dockerfile.distroless
- https://clickhouse.com/docs/reference/statements/create/row-policy
- https://clickhouse.com/docs/concepts/features/configuration/settings/settings-users
- https://hub.docker.com/v2/repositories/clickhouse/clickhouse-server/tags/26.8.2.7-distroless
- https://clickhouse.com/docs/resources/changelogs/security-changelog
- https://github.com/ClickHouse/ClickHouse/security/advisories
