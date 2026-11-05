# SPDX-License-Identifier: AGPL-3.0-only
"""Explicit per-phase headroom; not a replacement for local electrical protection."""
from datetime import datetime,timedelta
from decimal import Decimal,ROUND_FLOOR,localcontext,Context
from typing import Sequence
from .observation_health import Observation,assess_observation
from .charging_goals import _utc

def phase_headroom(limits_a: tuple[int,int,int], other_load: Sequence[Observation], *, now: datetime, tenant_id: str, site_id: str, max_age: timedelta) -> tuple[int,int,int] | None:
    """Caller supplies synchronized OTHER-load currents excluding controlled EVs.

    Total meter current cannot be passed as other load without an explicit upstream
    decomposition. Missing/stale values deny a usable budget, never become zero.
    Units are amperes; no assumed 230 V, phase topology, solar or export credit.
    """
    if len(limits_a)!=3 or len(other_load)!=3 or any(type(x) is not int or x<0 for x in limits_a):
        raise ValueError('Three nonnegative integer phase limits required')
    if len({o.asset_id for o in other_load})!=1:
        raise ValueError('Phase readings must come from one verified meter')
    result=[]
    for phase,(limit,observation) in enumerate(zip(limits_a,other_load)):
        if observation.signal!=f'other_load_phase_{phase+1}_a':
            raise ValueError('Explicit ordered phase-current signal required')
        health=assess_observation(observation,now=now,tenant_id=tenant_id,site_id=site_id,max_age=max_age)
        value=observation.value
        if not health.usable:return None
        if not isinstance(value,Decimal) or not value.is_finite() or value<0:
            raise ValueError('Nonnegative Decimal phase current required')
        with localcontext(Context(prec=28)):
            result.append(int(max(Decimal(0),Decimal(limit)-value).to_integral_value(rounding=ROUND_FLOOR)))
    if len({_utc(o.observed_at) for o in other_load})!=1:
        return None
    return tuple(result)
