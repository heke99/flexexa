"""Exercise the real grouped solver against a constructive, independent Wh oracle."""

import argparse
from collections import defaultdict
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
from time import perf_counter


def fixture_rows(flexexa, scenario):
    path = flexexa / 'scripts/quality/capacity-profile.mjs'
    output = subprocess.check_output(['node', str(path), scenario, 'vehicles'])
    return [json.loads(line) for line in output.splitlines()]


def inputs(vehicles, replan):
    site_vehicles = defaultdict(list)
    for vehicle in vehicles:
        site_vehicles[vehicle['siteId']].append(vehicle)
    tight_site = next(iter(site_vehicles))
    sites = []
    peak_start, peak_end = (8, 11) if replan else (16, 20)
    cheap_start, cheap_end = (12, 15) if replan else (1, 5)
    for index, (site_id, vehicles_at_site) in enumerate(site_vehicles.items()):
        tight = site_id == tight_site
        assets = []
        for vehicle in vehicles_at_site:
            number = int(vehicle['vehicleId'].split('-')[1])
            duration_change = 4 if replan and number % 3 == 0 else 0
            assets.append({
                'id': vehicle['vehicleId'],
                'required_wh': 5_000 + (number * 619 % 10_000),
                'max_wh_per_slot': [1_850, 2_750, 2_750, 2_750, 5_500][number % 5],
                'first_slot': 24 if tight else number % 30,
                'end_slot': 28 if tight else 67 + (number % 30) - duration_change,
                'priority': 1 + number % 3,
                'mode': 'paused' if number % 19 == 0 else ('now' if number % 13 == 0 else 'smart'),
            })
        slots = []
        for quarter in range(96):
            hour = quarter // 4
            price = (
                (12 if replan else 35) + 4 * hour + (11 * quarter + index) % 12
                + (80 if peak_start <= hour <= peak_end else 0)
                - (55 if cheap_start <= hour <= cheap_end else 0)
            ) / 100
            available_wh = 22_000 if tight else len(assets) * (225 if 28 <= quarter < 64 else 360)
            slots.append({'available_wh': available_wh, 'price_sek_per_kwh': price})
        sites.append({'id': site_id, 'slots': slots, 'assets': assets})
    return {'sites': sites}, tight_site


def expected_maximum(site, tight):
    # Upper bound: all non-paused requests on a normal site. On the tight
    # site every eligible asset shares one window, so its capacity is tighter.
    eligible = [asset for asset in site['assets'] if asset['mode'] != 'paused']
    remaining = [slot['available_wh'] for slot in site['slots']]
    upper = sum(asset['required_wh'] for asset in eligible)
    if tight:
        start, end = eligible[0]['first_slot'], eligible[0]['end_slot']
        assert all(asset['first_slot'] == start and asset['end_slot'] == end for asset in eligible)
        upper = min(upper, sum(remaining[start:end]))

    # Construct a feasible witness schedule using a separate earliest-deadline
    # greedy algorithm. Equality with the upper bound establishes the optimum.
    witness = 0
    for asset in sorted(eligible, key=lambda asset: asset['end_slot']):
        missing = asset['required_wh']
        for quarter in range(asset['first_slot'], asset['end_slot']):
            transfer = min(missing, remaining[quarter], asset['max_wh_per_slot'])
            missing -= transfer
            witness += transfer
            remaining[quarter] -= transfer
            if missing == 0:
                break
    assert witness == upper, (site['id'], witness, upper)
    return upper


def validate(problem, result, tight_site):
    asset_sites = {}
    asset_specs = {}
    caps = {}
    site_expected_wh = {}
    for site in problem['sites']:
        assert len(site['slots']) == 96
        site_expected_wh[site['id']] = expected_maximum(site, site['id'] == tight_site)
        caps[site['id']] = [slot['available_wh'] for slot in site['slots']]
        for asset in site['assets']:
            assert asset['id'] not in asset_sites
            asset_sites[asset['id']] = site['id']
            asset_specs[asset['id']] = asset

    transfers = set()
    used = defaultdict(int)
    allocated = defaultdict(int)
    for row in result['allocations']:
        asset_id, quarter, wh = row['asset_id'], row['slot'], row['wh']
        spec = asset_specs[asset_id]
        assert (asset_id, quarter) not in transfers
        transfers.add((asset_id, quarter))
        assert type(quarter) is int and spec['first_slot'] <= quarter < spec['end_slot']
        assert type(wh) is int and 0 < wh <= spec['max_wh_per_slot']
        assert spec['mode'] != 'paused'
        used[(asset_sites[asset_id], quarter)] += wh
        allocated[asset_id] += wh

    for (site_id, quarter), wh in used.items():
        assert wh <= caps[site_id][quarter]

    site_allocated = defaultdict(int)
    site_unmet = defaultdict(int)
    paused_wh = 0
    assert set(result['unmet_wh']) == set(asset_specs)
    for asset_id, spec in asset_specs.items():
        unmet = result['unmet_wh'][asset_id]
        assert type(unmet) is int and 0 <= unmet <= spec['required_wh']
        assert unmet + allocated[asset_id] == spec['required_wh']
        site_allocated[asset_sites[asset_id]] += allocated[asset_id]
        site_unmet[asset_sites[asset_id]] += unmet
        if spec['mode'] == 'paused':
            assert allocated[asset_id] == 0
            paused_wh += unmet

    assert len(result['sites']) == len(site_expected_wh) == 84
    assert {site['id'] for site in result['sites']} == set(site_expected_wh)
    for summary in result['sites']:
        site_id = summary['id']
        assert summary['allocated_wh'] == site_allocated[site_id] == site_expected_wh[site_id]
        assert summary['unmet_wh'] == site_unmet[site_id]
    required_wh = sum(spec['required_wh'] for spec in asset_specs.values())
    allocated_wh, unmet_wh = sum(allocated.values()), sum(result['unmet_wh'].values())
    assert result['allocated_wh'] == allocated_wh == sum(site_expected_wh.values())
    assert required_wh == allocated_wh + unmet_wh
    assert result['dispatch_ready'] is False and result['execution'] == 'not_dispatched'
    assert len(asset_specs) == 12_000
    assert unmet_wh > paused_wh and site_allocated[tight_site] == 88_000

    return {
        'solverVersion': result['version'],
        'solverSeconds': round(result['elapsed_seconds'], 3),
        'sites': len(site_expected_wh),
        'resources': len(asset_specs),
        'allocations': len(transfers),
        'requiredWh': required_wh,
        'allocatedWh': allocated_wh,
        'unmetWh': unmet_wh,
        'pausedWh': paused_wh,
        'tightSite': tight_site,
        'tightSiteAllocatedWh': site_allocated[tight_site],
        'tightSiteUnmetExcludingPausedWh': unmet_wh - paused_wh,
        'dispatchReady': result['dispatch_ready'],
    }


def main():
    parser = argparse.ArgumentParser()
    flexexa_root = Path(__file__).resolve().parents[2]
    parser.add_argument('--flexexa', default=flexexa_root, type=Path)
    parser.add_argument('--charging', default=flexexa_root.parent / 'charging-subscription', type=Path)
    args = parser.parse_args()
    args.flexexa = args.flexexa.resolve()
    args.charging = args.charging.resolve()
    solver = args.charging / 'workers/fleet-planner/solver.py'
    revision = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=args.charging, text=True).strip()
    solver_hash = hashlib.sha256(solver.read_bytes()).hexdigest()
    profile_path = args.flexexa / 'docs/progress/capacity-profile.v1.json'
    profile_hash = hashlib.sha256(profile_path.read_bytes()).hexdigest()
    versions = subprocess.check_output([sys.executable, '-c',
        'import numpy, ortools; print(numpy.__version__, ortools.__version__)'], text=True).split()
    initial_allocations = None
    for scenario, replan in [('distributed', False), ('concentrated', False), ('concentrated', True)]:
        vehicles = fixture_rows(args.flexexa, scenario)
        assert len({vehicle['tenantId'] for vehicle in vehicles}) == (12 if scenario == 'distributed' else 1)
        problem, tight_site = inputs(vehicles, replan)
        raw = json.dumps(problem, separators=(',', ':')).encode()
        env = {**os.environ, 'OPENBLAS_NUM_THREADS': '1', 'OMP_NUM_THREADS': '1',
               'PYTHONDONTWRITEBYTECODE': '1'}
        start = perf_counter()
        run = subprocess.run([sys.executable, str(solver)], input=raw, cwd=args.charging, env=env,
                             check=True, capture_output=True, timeout=250)
        wall = perf_counter() - start
        result = json.loads(run.stdout)
        evidence = validate(problem, result, tight_site)
        allocation_hash = hashlib.sha256(json.dumps(result['allocations'], separators=(',', ':')).encode()).hexdigest()
        if scenario == 'concentrated':
            if replan:
                assert allocation_hash != initial_allocations
            else:
                initial_allocations = allocation_hash
        print(json.dumps({
            'scope': 'local_offline_grouped_solver',
            'revision': revision,
            'solverSha256': solver_hash,
            'profileSha256': profile_hash,
            'numpyVersion': versions[0],
            'ortoolsVersion': versions[1],
            'scenario': scenario,
            'priceAndDepartureReplan': replan,
            'allocationSha256': allocation_hash,
            'inputBytes': len(raw),
            'outputBytes': len(run.stdout),
            'childWallSeconds': round(wall, 3),
            **evidence,
        }), flush=True)


if __name__ == '__main__':
    main()
