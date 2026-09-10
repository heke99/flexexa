#!/usr/bin/env python3
"""Real binding races and authenticated SQL -> canonical TypeScript route parity.
Fixtures are committed ONLY in disposable loopback Supabase. No provider HTTP,
OAuth, credentials or physical commands are involved. Never run on remote dev.
"""
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
spec = importlib.util.spec_from_file_location("core_verifier", Path(__file__).with_name("verify-core.py"))
if spec is None or spec.loader is None:
    raise RuntimeError("Missing authoritative core test helpers")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)
query, scalar, literal = core.query, core.scalar, core.sql_literal


def main() -> None:
    expected = {"ALLOW_ISOLATED_DB_TESTS":"1", "PGHOST":"127.0.0.1", "PGPORT":"54322", "PGUSER":"postgres", "PGDATABASE":"postgres"}
    if any(os.environ.get(key) != value for key, value in expected.items()):
        raise SystemExit("Refusing: disposable loopback Supabase and explicit test flag required")
    actor, org, tenant, member, customer, site, asset_a, asset_b, account = [str(uuid.uuid4()) for _ in range(9)]
    suffix = uuid.uuid4().hex
    query(f"""
      insert into auth.users(id,email) values('{actor}','registry-{suffix}@example.invalid');
      insert into public.organizations(id,name,slug) values('{org}','Disposable Connect','{suffix}');
      insert into public.tenants(id,organization_id,name,slug) values('{tenant}','{org}','Disposable Connect','{suffix}');
      insert into public.memberships(id,tenant_id,user_id) values('{member}','{tenant}','{actor}');
      insert into public.membership_roles(tenant_id,membership_id,role_id)
        select '{tenant}','{member}',id from public.roles where tenant_id='{tenant}' and role_key='tenant_admin';
      insert into public.customers(id,tenant_id,customer_type,display_name) values('{customer}','{tenant}','person','Connect fixture');
      insert into public.sites(id,tenant_id,customer_id,name) values('{site}','{tenant}','{customer}','Connect fixture');
      insert into public.assets(id,tenant_id,customer_id,site_id,asset_type,display_name)
        values('{asset_a}','{tenant}','{customer}','{site}','ev','Asset A'),('{asset_b}','{tenant}','{customer}','{site}','ev','Asset B');
      update public.integration_providers set status='active' where key in ('enode','ocpp');
      insert into public.provider_accounts(id,tenant_id,customer_id,provider_id,environment,external_account_id,connection_status)
        select '{account}','{tenant}','{customer}',id,'sandbox','fixture-account','connected' from public.integration_providers where key='enode';
    """)
    barrier = threading.Barrier(12)

    def contender(asset: str) -> tuple[bool, str]:
        barrier.wait(timeout=15)
        result = query(f"""begin; set local statement_timeout='30s';
          insert into public.asset_connections(tenant_id,customer_id,asset_id,provider_account_id,provider_id,environment,external_asset_id,connection_type,status,capabilities_json,capabilities_verified_at,health,last_seen_at,state_observed_at,valid_from)
          select '{tenant}','{customer}','{asset}','{account}',id,'sandbox','same-upstream-device','aggregated_api','connected','["read_soc"]','2026-09-09T12:00:00Z','healthy','2026-09-09T12:00:00Z','2026-09-09T11:00:00Z','2026-01-01'
          from public.integration_providers where key='enode';
          select pg_sleep(0.05); commit;""", allow_error=True)
        return result.returncode == 0, result.stderr

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results = list(pool.map(contender, [asset_a, asset_b]*6))
    winners = [ok for ok, _ in results if ok]
    rejected = [error for ok, error in results if not ok]
    if len(winners) != 1 or len(rejected) != 11 or not all('violates exclusion constraint' in error for error in rejected):
        raise RuntimeError(f"External binding concurrency invariant failed: {results}")
    rows = scalar(f"select jsonb_agg(jsonb_build_object('asset_id',asset_id)) from public.asset_connections where tenant_id='{tenant}'")
    if len(rows) != 1:
        raise RuntimeError("Concurrent binding produced duplicate/partial rows")
    selected_asset = rows[0]['asset_id']
    # Same canonical asset through first-party OCPP, with no Enode account dependence.
    query(f"""
      insert into public.provider_accounts(tenant_id,customer_id,provider_id,environment,external_account_id,connection_status)
        select '{tenant}','{customer}',id,'sandbox','direct-account','connected' from public.integration_providers where key='ocpp';
      insert into public.asset_connections(tenant_id,customer_id,asset_id,provider_account_id,provider_id,environment,external_asset_id,connection_type,status,capabilities_json,capabilities_verified_at,health,last_seen_at,state_observed_at,valid_from)
        select '{tenant}','{customer}','{selected_asset}',a.id,a.provider_id,'sandbox','direct-device','ocpp','connected','["read_soc"]','2026-09-09T12:00:00Z','healthy','2026-09-09T12:00:00Z','2026-09-09T11:00:00Z','2026-01-01'
        from public.provider_accounts a join public.integration_providers p on p.id=a.provider_id where a.tenant_id='{tenant}' and p.key='ocpp';
    """)
    claims = literal(json.dumps({"sub":actor,"role":"authenticated","aal":"aal1"}))
    actual = scalar(f"""begin; set local role authenticated; set local request.jwt.claims={claims};
      select jsonb_build_object('scope',jsonb_build_object('tenant_id','{tenant}','asset_id','{selected_asset}','environment','sandbox'),
        'routes',public.flexexa_get_connection_routes('{tenant}','{selected_asset}','sandbox')); rollback;""")
    checked = subprocess.run(["node","--experimental-strip-types",str(ROOT / 'scripts/database/check-connect-routes.mjs')],
        input=json.dumps(actual),text=True,capture_output=True,timeout=15,check=False)
    if checked.returncode:
        raise RuntimeError(f"Canonical route checker failed: {checked.stderr[-4000:]}")
    parity = json.loads(checked.stdout)
    if parity.get('authenticated_sql_routes_validated') != 2:
        raise RuntimeError('Canonical parser did not validate the actual SQL route output')
    evidence = scalar(f"""select jsonb_build_object('audit',(select count(*) from public.audit_events where tenant_id='{tenant}'),
      'outbox',(select count(*) from public.outbox_events where tenant_id='{tenant}'))""")
    if evidence != {'audit':0,'outbox':0}:
        raise RuntimeError('Inventory verification unexpectedly initiated side effects')
    print(json.dumps({'binding_race_calls':12,'unique_binding_winner':1,'overlapping_bindings_rejected':11,
      'canonical_route_parity':parity,'physical_commands_sent':0,'database':'disposable loopback Supabase only'},sort_keys=True))


if __name__ == '__main__':
    main()
