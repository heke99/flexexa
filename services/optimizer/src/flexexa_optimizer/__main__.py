# SPDX-License-Identifier: AGPL-3.0-only
"""Reproducible synthetic demand demo; never sends hardware commands."""
import json
from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from .charging_goals import GoalInput, evaluate_goal


def main():
    now = datetime(2026, 11, 5, 18, tzinfo=UTC)
    # Explicit sample capacities/efficiencies, not specifications for a real car.
    first = GoalInput('demo-tenant', 'demo-site', 'simulated-car-a', True,
                      Decimal(80), now+timedelta(hours=12), Decimal(40), Decimal(20), Decimal('.8'))
    second = replace(first, asset_id='simulated-car-b', target_soc_percent=Decimal(60))
    def evaluate(goal):
        return asdict(evaluate_goal(goal, now=now, tenant_id='demo-tenant', site_id='demo-site'))
    output = {
        'mode': 'synthetic_energy_demand_only',
        'before': [evaluate(first), evaluate(second)],
        'after_car_a_target_change': [evaluate(replace(first,target_soc_percent=Decimal(90))),evaluate(second)],
        'physical_feasibility_verified': False,
        'device_commands_sent': False,
    }
    def encode(value):
        if isinstance(value, Decimal): return str(value)
        if isinstance(value, datetime): return value.isoformat()
        raise TypeError('Unsupported demo value')
    print(json.dumps(output, default=encode, indent=2))


if __name__ == '__main__':
    main()
