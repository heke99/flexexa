# SPDX-License-Identifier: AGPL-3.0-only
"""Deterministic synthetic projections. Never connects to DB, providers or cars."""
import json
import sys
from pathlib import Path
from datetime import UTC,datetime,timedelta
from decimal import Decimal as D
from .charging_cost import PriceComponents,quote_energy
from .interval_optimizer import PlanningSlot,PlanningVehicle,optimize_intervals

def projections():
    def uid(n):return f'f7000000-0000-4000-8000-{n:012d}'
    now=datetime(2026,11,5,18,tzinfo=UTC)
    def iso(t):return t.isoformat().replace('+00:00','Z')
    companies=[];platform=[]
    for number,label in [(1,'Gridex EL · testföretag'),(2,'Partner Energi · testföretag')]:
        tenant,site=uid(number),uid(number+10)
        price=PriceComponents(D('.85'),D('.08'),D('.25'),D('.36'),D('.25'),version='synthetic-2026-11-05')
        slots=[PlanningSlot(now+timedelta(hours=i),now+timedelta(hours=i+1),(16,16,16),(D(230),)*3,price if i==1 else PriceComponents(D('1.5'),price.retailer,price.grid_transfer,price.tax,price.vat_rate,version=price.version)) for i in range(3)]
        cars=[PlanningVehicle(tenant,site,uid(number*100+i),uid(number*100+20+i),(0,),6,16,energy,energy,now,now+timedelta(hours=3)) for i,energy in [(1,D('1.38')),(2,D('2.30'))]]
        result=optimize_intervals(cars,slots,tenant_id=tenant,site_id=site)
        if result.status!='optimal':raise RuntimeError(result.status)
        assets=[];timeline=[]
        for i,car in enumerate(cars):
            intervals=[r for r in result.intervals if r.asset_id==car.asset_id]
            electricity=D(0);variable=D(0);energy=D(0)
            for r in intervals:
                slot=next(s for s in slots if s.starts_at==r.starts_at)
                quote=quote_energy(r.input_energy_kwh,slot.price)
                electricity+=quote['electricity'];variable+=quote['variable_total'];energy+=r.input_energy_kwh
                timeline.append({'asset_id':car.asset_id,'starts_at':iso(r.starts_at),'ends_at':iso(r.ends_at),'current_a':r.current_a,'energy_kwh':str(r.input_energy_kwh)})
            assets.append({'asset_id':car.asset_id,'site_id':site,'label':('BMW 330e 2023' if i==0 else 'Elbil 2')+' · simulerad','plan_status':'optimal','departure_at':iso(car.departure_at),'energy_kwh':str(energy),'electricity':str(electricity),'variable_total':str(variable),'total':None,'currency':'SEK'})
        assets.append({'asset_id':uid(number*100+3),'site_id':site,'label':'Laddpunkt 3 · simulerad','plan_status':'blocked','departure_at':iso(now+timedelta(hours=3)),'energy_kwh':'0','electricity':'0','variable_total':'0','total':None,'currency':'SEK'})
        overview={'tenant_id':tenant,'generated_at':iso(now),'mode':'simulation','assets':assets}
        companies.append({'label':label,'overview':overview,'timeline':timeline})
        platform.append({'tenant_id':tenant,'label':label,'asset_count':len(assets),'planned_count':2,'blocked_count':1})
    return {'company':companies[0],'platform':{'generated_at':iso(now),'mode':'simulation','companies':platform}}

if __name__=='__main__':
    path=Path(sys.argv[1]);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(projections(),ensure_ascii=False,indent=2)+'\n')
