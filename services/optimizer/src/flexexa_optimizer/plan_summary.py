# SPDX-License-Identifier: AGPL-3.0-only
# Adapted presentation responsibilities from EnergyWizard plan_brief.py/timeline.py.
# See NOTICE.md and COPYING. Internal view model; no new plan or device commands.
from dataclasses import dataclass
from datetime import datetime
from decimal import Context, Decimal, localcontext
from typing import Sequence
from .charging_goals import _utc

@dataclass(frozen=True)
class EnergyInterval:
    tenant_id: str
    site_id: str
    asset_id: str
    starts_at: datetime
    ends_at: datetime
    kind: str
    power_kw: Decimal | None
    price_per_kwh: Decimal | None = None

@dataclass(frozen=True)
class EnergySummary:
    asset_id: str
    kind: str
    starts_at: datetime
    ends_at: datetime
    energy_kwh: Decimal | None
    known_energy_kwh: Decimal
    energy_complete: bool
    energy_cost: Decimal | None
    cost_complete: bool

def summarize_intervals(intervals: Sequence[EnergyInterval], *, tenant_id: str, site_id: str) -> tuple[EnergySummary, ...]:
    """Summarize real elapsed intervals, keeping planned and measured separate.

    Cost is only energy times the supplied unit price, NOT full household cost.
    Missing coverage between supplied intervals is not inferred or filled with zero.
    The authenticated caller verifies canonical ownership and coverage provenance.
    """
    if not tenant_id or not site_id:
        raise ValueError('Trusted scope required')
    grouped = {}
    for interval in intervals:
        if (interval.tenant_id,interval.site_id)!=(tenant_id,site_id):
            raise PermissionError('Interval scope mismatch')
        if not interval.asset_id or interval.kind not in ('planned','measured'):
            raise ValueError('Asset and explicit planned/measured kind required')
        start,end=_utc(interval.starts_at),_utc(interval.ends_at)
        if end<=start:
            raise ValueError('Positive elapsed interval required')
        for value in (interval.power_kw,interval.price_per_kwh):
            if value is not None and (not isinstance(value,Decimal) or not value.is_finite()):
                raise ValueError('Finite Decimal values required')
        if interval.power_kw is not None and interval.power_kw<0:
            raise ValueError('Charging import power must be nonnegative')
        grouped.setdefault((interval.asset_id,interval.kind),[]).append((start,end,interval))
    output=[]
    for (asset,kind),rows in sorted(grouped.items()):
        rows.sort(key=lambda row:row[0])
        if any(a[1]>b[0] for a,b in zip(rows,rows[1:])):
            raise ValueError('Overlapping intervals would double-count energy')
        # Keep gaps as separate blocks, never present uncovered time as continuous.
        blocks=[]
        for row in rows:
            if not blocks or blocks[-1][-1][1]!=row[0]:blocks.append([])
            blocks[-1].append(row)
        for block in blocks:
            complete=all(row[2].power_kw is not None for row in block)
            priced=complete and all(row[2].price_per_kwh is not None for row in block)
            with localcontext(Context(prec=28)):
                energy=Decimal(0);cost=Decimal(0)
                for start,end,row in block:
                    if row.power_kw is None:continue
                    duration=end-start
                    seconds=Decimal(duration.days*86400+duration.seconds)+Decimal(duration.microseconds)/Decimal(1000000)
                    amount=row.power_kw*seconds/Decimal(3600)
                    energy+=amount
                    if row.price_per_kwh is not None:cost+=amount*row.price_per_kwh
            output.append(EnergySummary(asset,kind,block[0][0],block[-1][1],energy if complete else None,energy,complete,cost if priced else None,priced))
    return tuple(output)
