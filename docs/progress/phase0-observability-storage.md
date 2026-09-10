# Phase 0 durable operational traces — candidate

Scope: locked §§71–73/77/83. The identity SDK uses the official Collector ClickHouse
exporter. Schema is migration-owned (`create_schema: false`); the exporter has INSERT
on one operational trace table, no SELECT, DDL or business telemetry privileges.
Collector queue writes fsync to a dedicated directory, bounded at 64 MiB / 1,024
items. Exporter batching replaces the standalone in-memory batch processor in this
pipeline. Existing core Collector and tenant telemetry tests remain unchanged.

This sandbox pipeline accepts only identity-service spans, removes unknown resource/
span attributes before queueing and rejects free-text events/links/status/tracestate.
The table separately validates allowed attributes and bounded identifiers. Operational
readers are scoped by environment, with unassigned readers denied. These are platform
trace records, not tenant business facts, canonical audit or an authorization source.
No customer access or Supabase/IAM integration is implied by the fixture roles.

The 72-hour development trace retention is explicit. At-least-once retries can create
physical duplicates; ReplacingMergeTree plus FINAL reads deduplicate stable trace/span
identities. This is not exactly-once delivery or transaction audit. Disk loss, host loss,
SDK-side queue loss and outages beyond queue capacity remain outside this boundary.

Required executed evidence: real SDK-to-Collector-to-ClickHouse storage and parentage;
private values absent; insert-only writer and read/environment denials; replay reads;
ClickHouse stop followed by queued SDK delivery, SIGKILL and replacement of Collector,
then recovered queued span; retained database data; actual TTL removal; private/non-root
containers and image scans. Collector is pinned to the digest observed in CI
`34499789852`; final complete CI must pass before merge. No production deployment
is claimed. The initial schema failure was isolated to empty-string equality checks;
equivalent length-zero constraints retain the data restrictions. Negative inserts
explicitly check that free text and unknown attributes are rejected.

Skills: observability, Docker/local stack, ClickHouse, index/impact/affected verification,
code/security review, performance and test strategy; upstream guidance applies only to
its provider surface. AWS/Vercel deployment, provider actions and Postgres DDL are outside
this increment. ClickHouse-only migrations now explicitly require runtime protocol/
container checks in impact analysis; the existing forward-history guard remains active.

Official component references (v0.160.0):
- https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.160.0/exporter/clickhouseexporter
- https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/v0.160.0/extension/storage/filestorage

PR #37 was merged as `16ceb7b1bea05c063742e51a273408e6b8cea49e`, final run
`34497100503`, all six jobs / 635 SQL assertions. Fresh development readback at
`2026-09-10T15:45:14Z` verified 19 migration hashes and 1,322 catalog objects with
zero differences. The new trace increment must preserve that database baseline.
