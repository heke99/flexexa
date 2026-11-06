# SPDX-License-Identifier: AGPL-3.0-only
"""Read the normalized public price contract; no network or physical commands."""
from dataclasses import replace
from datetime import datetime,timedelta
from decimal import Decimal
from .charging_goals import _utc
from .interval_optimizer import PlanningSlot

def priced_slots(day,*,expected_area,expected_date,now,maximum_age,headroom_by_start,voltage_v,tariff):
    if not isinstance(maximum_age,timedelta) or maximum_age<=timedelta(0):raise ValueError('Explicit positive age limit required')
    if day.get('source')!='elprisetjustnu.se' or day.get('currency')!='SEK' or day.get('unit')!='kWh' or day.get('vat_included') is not False:raise ValueError('Normalized ex-VAT spot data required')
    if day.get('area') not in ('SE1','SE2','SE3','SE4') or day.get('area')!=expected_area or day.get('date')!=expected_date:raise ValueError('Explicit market area required')
    fetched=_utc(datetime.fromisoformat(day['fetched_at']));at=_utc(now)
    if fetched>at or at-fetched>maximum_age:raise ValueError('Price snapshot is stale or from the future')
    rows=day.get('intervals')
    if not isinstance(rows,list) or not 23<=len(rows)<=100:raise ValueError('Full normalized day required')
    slots=[];previous=None
    for row in rows:
        start=_utc(datetime.fromisoformat(row['starts_at']));end=_utc(datetime.fromisoformat(row['ends_at']))
        if end-start not in (timedelta(minutes=15),timedelta(hours=1)) or previous and start!=previous:raise ValueError('Contiguous actual intervals required')
        market=Decimal(row['spot_sek_per_kwh_ex_vat'])
        price=replace(tariff,market=market,version=f'{tariff.version}:{day["area"]}:{fetched.isoformat()}');price.validate()
        slots.append(PlanningSlot(start,end,headroom_by_start.get(start),voltage_v,price));previous=end
    if sum((s.ends_at-s.starts_at for s in slots),timedelta(0)) not in (timedelta(hours=23),timedelta(hours=24),timedelta(hours=25)):raise ValueError('Incomplete day')
    return tuple(slots)
