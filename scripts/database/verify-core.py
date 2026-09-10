#!/usr/bin/env python3
"""Run SQL/TypeScript fixture parity and real concurrent RPCs on isolated CI Postgres.
Never point this script at a remote development/production database. Fixtures are
committed only in the disposable local Supabase; `supabase stop --no-backup` removes them.
No third-party Python packages, external HTTP calls, production keys or guessed tests.
"""
from __future__ import annotations
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import threading
import uuid


def sql_literal(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def query(sql: str, *, allow_error: bool = False) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["psql", "-XAtq", "--set=ON_ERROR_STOP=1", "--set=VERBOSITY=terse", "--command", sql],
        text=True, capture_output=True, timeout=40, check=False,
    )
    if result.returncode and not allow_error:
        raise RuntimeError(f"Isolated SQL verification failed: {result.stderr.strip()}")
    return result


def scalar(sql: str) -> dict | list | str | int:
    result = query(sql)
    lines = [line for line in result.stdout.splitlines() if line.strip()]
    if len(lines) != 1:
        raise RuntimeError("Expected exactly one JSON verification result")
    return json.loads(lines[0])


def verify_parity() -> int:
    root = Path(__file__).resolve().parents[2]
    fixtures = subprocess.run(["node", str(root / "packages/api-contracts/test/fixtures/core-mutations.mjs")], text=True, capture_output=True, check=True, timeout=10)
    cases = json.loads(fixtures.stdout)
    if len(cases) < 80:
        raise RuntimeError("Shared contract fixture coverage was unexpectedly reduced")
    for case in cases:
        payload = sql_literal(json.dumps(case["input"], ensure_ascii=False))
        kind = sql_literal(case["kind"])
        result = query(f"select private.flexexa_normalize_core_input({kind},{payload}::jsonb);", allow_error=True)
        if "error" in case:
            if result.returncode == 0 or case["error"] not in result.stderr:
                raise RuntimeError(f"SQL accepted invalid shared fixture: {case['name']}")
        elif result.returncode or json.loads(result.stdout) != case["expected"]:
            raise RuntimeError(f"SQL canonical normalization mismatch: {case['name']}: {result.stderr}")
    return len(cases)


def main() -> None:
    if os.environ.get("ALLOW_ISOLATED_DB_TESTS") != "1" or os.environ.get("PGHOST") != "127.0.0.1" or os.environ.get("PGPORT") != "54322":
        raise SystemExit("Refusing: explicit isolated-test flag and loopback Supabase database are required")
    if os.environ.get("PGDATABASE") != "postgres" or os.environ.get("PGUSER") != "postgres":
        raise SystemExit("Refusing unexpected isolated database/user")
    parity = verify_parity()
    actor, org, tenant, membership = [str(uuid.uuid4()) for _ in range(4)]
    suffix = uuid.uuid4().hex
    query(f"""
        insert into auth.users(id,email) values('{actor}','concurrency-{suffix}@example.invalid');
        insert into public.organizations(id,name,slug) values('{org}','Disposable concurrency test','{suffix}');
        insert into public.tenants(id,organization_id,name,slug) values('{tenant}','{org}','Disposable concurrency test','{suffix}');
        insert into public.memberships(id,tenant_id,user_id) values('{membership}','{tenant}','{actor}');
        insert into public.membership_roles(tenant_id,membership_id,role_id)
          select '{tenant}','{membership}',id from public.roles where tenant_id='{tenant}' and role_key='tenant_admin';
    """)
    claims = sql_literal(json.dumps({"sub": actor, "role": "authenticated", "aal": "aal1"}))

    def race(key: str, names: list[str]) -> list[tuple[bool, object]]:
        barrier = threading.Barrier(len(names))
        def worker(name: str) -> tuple[bool, object]:
            payload = sql_literal(json.dumps({"customer_type": "person", "display_name": name}))
            correlation = str(uuid.uuid4())
            barrier.wait(timeout=15)
            # Hold the winner transaction open briefly so uniqueness contention is real.
            result = query(f"""begin; set local statement_timeout='30s';
                set local role authenticated; set local request.jwt.claims={claims};
                select public.flexexa_create_customer('{tenant}',{payload}::jsonb,'{key}','{correlation}');
                select pg_sleep(0.05); commit;""", allow_error=True)
            if result.returncode:
                return False, result.stderr
            rows = [line for line in result.stdout.splitlines() if line.strip()]
            if len(rows) != 1:
                raise RuntimeError("Concurrent call did not return one receipt")
            return True, json.loads(rows[0])
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(names)) as pool:
            return list(pool.map(worker,names))

    same = race("same-key",["Same canonical customer"]*16)
    if not all(ok for ok,_ in same):
        raise RuntimeError(f"Identical concurrent request failed: {same}")
    first = same[0][1]
    if not all(receipt == first for _,receipt in same):
        raise RuntimeError("Concurrent identical calls returned different receipts/correlations")
    mixed = race("mixed-key",["Candidate A"]*8+["Candidate B"]*8)
    winners = [receipt for ok,receipt in mixed if ok]
    failures = [error for ok,error in mixed if not ok]
    if len(winners)!=8 or len(failures)!=8 or not all("IDEMPOTENCY_CONFLICT" in str(error) for error in failures):
        raise RuntimeError(f"Conflicting concurrent request was not rejected atomically: {mixed}")
    if not all(receipt == winners[0] for receipt in winners):
        raise RuntimeError("Mixed-race winners disagree about the committed result")
    counts = scalar(f"""select jsonb_build_object(
      'customers',(select count(*) from public.customers where tenant_id='{tenant}'),
      'receipts',(select count(*) from public.idempotency_records where tenant_id='{tenant}'),
      'audits',(select count(*) from public.audit_events where tenant_id='{tenant}'),
      'outbox',(select count(*) from public.outbox_events where tenant_id='{tenant}'),
      'unfinished',(select count(*) from public.idempotency_records where tenant_id='{tenant}' and status<>'completed'))""")
    if counts != {"customers":2,"receipts":2,"audits":2,"outbox":2,"unfinished":0}:
        raise RuntimeError(f"Concurrency left duplicate/partial records: {counts}")
    print(json.dumps({"shared_sql_contract_cases_passed":parity,"concurrent_calls":32,
       "identical_replays":16,"mixed_winners":8,"conflicting_payloads_rejected":8,
       "atomic_record_counts":counts,"database":"disposable loopback Supabase only"},sort_keys=True))

if __name__ == "__main__":
    main()
