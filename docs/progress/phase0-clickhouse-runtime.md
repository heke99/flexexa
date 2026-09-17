# Phase 0 ClickHouse runtime boundary

Locked §§30/77/83. Active skills: ClickHouse, Docker/local-stack, codebase index,
impact, affected/full verification, code/security review and test strategy. Conditional
Postgres ingestion, AWS and provider integration are deferred to their implementation;
frontend/browser skills are skipped because this boundary has no UI.

The isolated schema/runtime candidate uses real SQL, two-tenant negative queries,
denied tenant writes, unmatched-reader denial, typed samples, versioned development
retention and persistence of data/access policy through restart. CI is required because
there is no local Docker daemon. Final tested tree/run and scan evidence belong in the PR.

This is not a production telemetry pipeline or completed Phase 0. Canonical Postgres
ownership verification before ingestion, durable inbox, aggregate models/retention,
central authorization, TLS/HA, archive/restore and deployment remain separate gates.
