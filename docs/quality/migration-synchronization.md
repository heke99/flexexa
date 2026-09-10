# Migration history synchronization

`pnpm db:history:check -- --base origin/phase/0-foundation` runs in every affected
application verification. Applied SQL hashes are checked against source and the base
branch, so changing both an old file and its manifest cannot hide a rewrite. Missing,
duplicate and backdated versions fail. Unapplied candidates may append after the
applied prefix; they are reported as pending, never as development synchronization.

For each promotion:

1. Create the new migration with Supabase CLI; preserve every applied file.
2. Publish and pass isolated full replay, RLS and applicable RPC/concurrency gates.
3. Apply that exact SQL through the authorized development migration operation.
4. Read back the recorded version, name, SHA-256 and byte count. Rename only the new
   candidate to the recorded version and append its exact hash to the applied ledger.
5. Obtain a fresh read-only history snapshot from the selected project. The SQL below
   returns `captured_at` and `migrations`; add `project_id` from the verified tool/connection
   target, not from an arbitrary label supplied by the data itself. Save only that JSON
   envelope to a temporary file. It contains no credentials or business data.
6. Run `pnpm db:history:check -- --base origin/phase/0-foundation --snapshot /tmp/flexexa-dev-history.json`.
7. Run final CI on the tracked version, review threads and merge using expected head SHA.

```sql
select jsonb_build_object(
 'captured_at', clock_timestamp(),
 'migrations', (select jsonb_agg(jsonb_build_object(
  'version', version, 'name', name,
  'bytes', octet_length(array_to_string(statements,E'\n')),
  'sha256', encode(extensions.digest(array_to_string(statements,E'\n'),'sha256'),'hex')
 ) order by version) from supabase_migrations.schema_migrations)
) as snapshot;
```

The snapshot checker requires the configured development project, a capture no older
than fifteen minutes, the exact full version/name set, all source files pinned, and
exact recorded hashes/lengths. It has no normalization mode, repair or write operation.
Snapshots are trusted operator inputs, not cryptographically authenticated attestations.
Do not relabel an old capture or use a local database snapshot as development evidence.
CI itself never claims a fresh live read; no development credentials are exposed to PRs.

## Reviewed historical differences

The first imported history contains four known comment/formatting differences:
`20260909104034`, `20260909104116`, `20260909104210`, `20260909112319`.
Their reread recorded SQL and repository SQL had matching literal-preserving token
sequences (2038, 1700, 1211 and 1179 tokens). Both exact source and recorded hashes,
and recorded byte counts, are pinned in `development-migration-policy.json`.
Subsequent edits to this exception policy fail comparison with the base branch.
This baseline does not authorize new exceptions or changes to recorded history.

The other eleven current migrations match byte-for-byte. All fifteen are pinned.
PR #20 final run `34450850188` passed all application gates, 489 SQL assertions and
all real RPC/concurrency checks before merge `a9611c9b7502d62a15dba6da753c76f80350e28e`.

## Scope and verification

Activated repository Supabase/Postgres, codebase index/impact/affected verification,
code/security review and test strategy; reviewed master sections 70–71 and the
existing migration promotion workflow. No frontend, provider or AWS runtime change.
Twenty-five regression tests exercise history drift, candidate/promotion behavior,
exact historical exceptions, wrong project, stale/future capture and malformed input.

Migration history parity and clean replay do not detect every possible manual DDL
change outside the migration system. `liveSchemaVerified` remains false: live schema,
ACL/RLS checks and complete flow tests are separate evidence. This gate does not claim
live Auth provisioning, infrastructure readiness, production deployment or completion
of the master plan. It also does not copy business records between environments.
