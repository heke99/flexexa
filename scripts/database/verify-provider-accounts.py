#!/usr/bin/env python3
"""Shared contracts and genuinely concurrent account lifecycle RPCs; disposable CI only."""
from __future__ import annotations
import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import threading
import uuid

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('core_verifier', Path(__file__).with_name('verify-core.py'))
if spec is None or spec.loader is None:
    raise RuntimeError('Missing core verification helpers')
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
query, scalar, literal = core.query, core.scalar, core.sql_literal


def main() -> None:
    expected = {'ALLOW_ISOLATED_DB_TESTS':'1','PGHOST':'127.0.0.1','PGPORT':'54322','PGUSER':'postgres','PGDATABASE':'postgres'}
    if any(os.environ.get(k) != v for k, v in expected.items()):
        raise SystemExit('Refusing non-disposable database')
    cases = json.loads(subprocess.run(['node',str(ROOT/'packages/api-contracts/test/fixtures/provider-accounts.mjs')],capture_output=True,text=True,check=True,timeout=10).stdout)
    if len(cases) < 60:
        raise RuntimeError('Missing account contract coverage')
    for case in cases:
        result = query(f"select private.flexexa_normalize_provider_account_input({literal(case['kind'])},{literal(json.dumps(case['input']))}::jsonb);",allow_error=True)
        if 'error' in case:
            if not result.returncode or case['error'] not in result.stderr:
                raise RuntimeError(f"Invalid SQL fixture accepted: {case['name']}")
        elif result.returncode or json.loads(result.stdout) != case['expected']:
            raise RuntimeError(f"SQL contract mismatch: {case['name']}: {result.stderr}")
    actor, org, tenant, member, customer = [str(uuid.uuid4()) for _ in range(5)]
    suffix = uuid.uuid4().hex
    query(f"""
      insert into auth.users(id,email) values('{actor}','accounts-{suffix}@example.invalid');
      insert into public.organizations(id,name,slug) values('{org}','Disposable lifecycle','{suffix}');
      insert into public.tenants(id,organization_id,name,slug) values('{tenant}','{org}','Disposable lifecycle','{suffix}');
      insert into public.memberships(id,tenant_id,user_id) values('{member}','{tenant}','{actor}');
      insert into public.membership_roles(tenant_id,membership_id,role_id) select '{tenant}','{member}',id from public.roles where tenant_id='{tenant}' and role_key='tenant_admin';
      insert into public.customers(id,tenant_id,customer_type,display_name) values('{customer}','{tenant}','person','Disposable lifecycle');
    """)
    claims = literal(json.dumps({'sub':actor,'role':'authenticated','aal':'aal1'}))

    def race(kind: str, payloads: list[dict], keys: list[str]) -> list[tuple[bool, object]]:
        barrier = threading.Barrier(len(keys))
        def worker(pair: tuple[dict,str]) -> tuple[bool, object]:
            payload, key = pair
            barrier.wait(timeout=15)
            result = query(f"""begin; set local statement_timeout='30s'; set local role authenticated;
              set local request.jwt.claims={claims};
              select public.flexexa_{kind}_provider_account('{tenant}',{literal(json.dumps(payload))}::jsonb,{literal(key)},'{uuid.uuid4()}');
              select pg_sleep(0.05); commit;""",allow_error=True)
            if result.returncode:
                return False, result.stderr
            rows = [line for line in result.stdout.splitlines() if line.strip()]
            if len(rows) != 1:
                raise RuntimeError('Expected one transaction receipt')
            return True,json.loads(rows[0])
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(keys)) as pool:
            return list(pool.map(worker,zip(payloads,keys,strict=True)))

    def check(results: list[tuple[bool,object]], winners: int, error: str | None = None) -> dict:
        good = [body for ok,body in results if ok]
        bad = [body for ok,body in results if not ok]
        if len(good) != winners or (bad and (error is None or not all(error in str(body) for body in bad))):
            raise RuntimeError(f'Unexpected concurrent outcome: {results}')
        if not good or not all(body == good[0] for body in good):
            raise RuntimeError('Replays failed to preserve original receipt/correlation')
        return good[0]

    base = {'customer_id':customer,'provider_key':'enode','environment':'sandbox'}
    first = check(race('register',[base]*12,['register-same']*12),12)
    second = check(race('register',[{**base,'provider_key':p} for p in ['enode','ocpp']*6],['register-mixed']*12),6,'IDEMPOTENCY_CONFLICT')
    revoke = {'provider_account_id':first['resource_id'],'environment':'sandbox','reason_code':'security'}
    revoked_first = check(race('revoke',[revoke]*12,['revoke-same']*12),12)
    revoked_second = check(race('revoke',[{**revoke,'provider_account_id':second['resource_id']}]*12,[f'revoke-distinct-{i}' for i in range(12)]),1,'INVALID_STATE_TRANSITION')
    if first['status'] != 'registered' or revoked_first['status'] != 'revoked' or revoked_second['status'] != 'revoked':
        raise RuntimeError('Unexpected canonical receipt status')
    counts = scalar(f"""select jsonb_build_object(
      'accounts',(select count(*) from public.provider_accounts where tenant_id='{tenant}'),
      'revoked',(select count(*) from public.provider_accounts where tenant_id='{tenant}' and connection_status='revoked'),
      'receipts',(select count(*) from public.idempotency_records where tenant_id='{tenant}'),
      'audits',(select count(*) from public.audit_events where tenant_id='{tenant}'),
      'outbox',(select count(*) from public.outbox_events where tenant_id='{tenant}'),
      'unfinished',(select count(*) from public.idempotency_records where tenant_id='{tenant}' and status<>'completed'));""")
    if counts != {'accounts':2,'revoked':2,'receipts':4,'audits':4,'outbox':4,'unfinished':0}:
        raise RuntimeError(f'Non-atomic lifecycle evidence: {counts}')
    print(json.dumps({'shared_account_contract_cases':len(cases),'concurrent_account_rpc_calls':48,'mixed_conflicts_rejected':6,'duplicate_revocations_rejected':11,'atomic_record_counts':counts,'physical_commands_sent':0},sort_keys=True))


if __name__ == '__main__':
    main()
