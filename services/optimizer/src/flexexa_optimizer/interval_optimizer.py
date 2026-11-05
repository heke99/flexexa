# SPDX-License-Identifier: AGPL-3.0-only
# Interval-planning responsibility adapted from EnergyWizard decisions.py.
# HiGHS MILP replaces household heuristics; no DB, provider or command effects.
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal,Context,localcontext
from .charging_goals import _utc
from .charging_cost import PriceComponents

@dataclass(frozen=True)
class PlanningSlot:
    starts_at: datetime
    ends_at: datetime
    headroom_a: tuple[int,int,int] | None
    voltage_v: tuple[Decimal,Decimal,Decimal]
    price: PriceComponents

@dataclass(frozen=True)
class PlanningVehicle:
    tenant_id: str
    site_id: str
    asset_id: str
    connector_id: str
    phases: tuple[int,...]
    minimum_a: int
    maximum_a: int
    required_input_kwh: Decimal
    maximum_input_kwh: Decimal
    available_at: datetime
    departure_at: datetime

@dataclass(frozen=True)
class PlannedCurrent:
    asset_id: str
    starts_at: datetime
    ends_at: datetime
    current_a: int
    input_energy_kwh: Decimal
    variable_cost_unrounded: Decimal

@dataclass(frozen=True)
class OptimizationResult:
    status: str
    intervals: tuple[PlannedCurrent,...]
    objective: str = 'known_variable_energy_cost_only'
    physical_charging_verified: bool = False

def optimize_intervals(vehicles,slots,*,tenant_id:str,site_id:str) -> OptimizationResult:
    """Integer-amp MILP, fixed verified connector and phase topology per vehicle.

    maximum_input_kwh is an explicit caller bound, not an implicit overcharge
    margin. Headroom is a supplied horizon forecast, not a safety measurement.
    No flex commitments, phase switches, dynamic peak objective or solver fallback.
    """
    if not tenant_id or not site_id or len(vehicles)>10 or len(slots)>192:raise ValueError('Bounded scoped model required')
    if not vehicles or not slots:raise ValueError('Vehicles and slots required')
    if len({v.asset_id for v in vehicles})!=len(vehicles) or len({v.connector_id for v in vehicles})!=len(vehicles):raise ValueError('Unique verified assets/connectors required')
    times=[(_utc(s.starts_at),_utc(s.ends_at)) for s in slots]
    if any(e<=s for s,e in times) or any(a[1]>b[0] for a,b in zip(times,times[1:])):raise ValueError('Sorted nonoverlapping intervals required')
    for slot in slots:
        slot.price.validate()
        if slot.headroom_a is not None and (len(slot.headroom_a)!=3 or any(type(a) is not int or not 0<=a<=1000 for a in slot.headroom_a)):raise ValueError('Explicit integer phase headroom required')
        if len(slot.voltage_v)!=3 or any(not isinstance(v,Decimal) or not v.is_finite() or not 1<=v<=500 for v in slot.voltage_v):raise ValueError('Verified phase voltages required')
    for v in vehicles:
        if (v.tenant_id,v.site_id)!=(tenant_id,site_id):raise PermissionError('Model scope mismatch')
        if not v.asset_id or not v.connector_id or not v.phases or len(set(v.phases))!=len(v.phases) or any(type(p)is not int or p not in (0,1,2) for p in v.phases):raise ValueError('Explicit phase mapping required')
        if any(type(a)is not int for a in (v.minimum_a,v.maximum_a)) or not 0<v.minimum_a<=v.maximum_a<=1000:raise ValueError('Explicit current capability required')
        if any(not isinstance(x,Decimal) or not x.is_finite() for x in (v.required_input_kwh,v.maximum_input_kwh)) or not 0<=v.required_input_kwh<=v.maximum_input_kwh<=1000:raise ValueError('Explicit energy bounds required')
        if _utc(v.available_at)>=_utc(v.departure_at):raise ValueError('Positive availability window required')
    # Imports are lazy: unrelated pure primitives do not silently require a solver.
    import numpy as np
    from scipy.optimize import Bounds,LinearConstraint,milp
    n=len(vehicles)*len(slots);cost=np.zeros(2*n);upper=np.ones(2*n);matrix=[];lower=[];higher=[];factors={}
    with localcontext(Context(prec=28)):
        for vi,v in enumerate(vehicles):
            for si,slot in enumerate(slots):
                j=vi*len(slots)+si;s,e=times[si]
                delta=e-s;hours=(Decimal(delta.days*86400+delta.seconds)+Decimal(delta.microseconds)/1000000)/3600
                factor=sum((slot.voltage_v[p] for p in v.phases),Decimal(0))*hours/1000;factors[j]=factor
                active=slot.headroom_a is not None and s>=_utc(v.available_at) and e<=_utc(v.departure_at) and v.maximum_input_kwh>0
                upper[j]=v.maximum_a if active else 0;cost[j]=float(factor*slot.price.variable_rate())
                row=np.zeros(2*n);row[j]=1;row[n+j]=-v.maximum_a;matrix.append(row);lower.append(-np.inf);higher.append(0)
                row=np.zeros(2*n);row[j]=-1;row[n+j]=v.minimum_a;matrix.append(row);lower.append(-np.inf);higher.append(0)
        for si,slot in enumerate(slots):
            for phase in range(3):
                row=np.zeros(2*n)
                for vi,v in enumerate(vehicles):
                    if phase in v.phases:row[vi*len(slots)+si]=1
                matrix.append(row);lower.append(0);higher.append((slot.headroom_a or (0,0,0))[phase])
        for vi,v in enumerate(vehicles):
            row=np.zeros(2*n)
            for si in range(len(slots)):row[vi*len(slots)+si]=float(factors[vi*len(slots)+si])
            matrix.append(row);lower.append(float(v.required_input_kwh));higher.append(float(v.maximum_input_kwh))
        solution=milp(cost,integrality=np.ones(2*n),bounds=Bounds(np.zeros(2*n),upper),constraints=LinearConstraint(np.array(matrix),lower,higher),options={'time_limit':5.0,'mip_rel_gap':0.0})
        if solution.status==2:return OptimizationResult('infeasible',())
        if solution.status!=0 or solution.x is None:return OptimizationResult('solver_not_optimal',())
        amps=[int(round(x)) for x in solution.x[:n]]
        if any(abs(float(solution.x[j])-amps[j])>1e-6 for j in range(n)):return OptimizationResult('invalid_solver_result',())
        output=[];totals=[Decimal(0) for _ in vehicles]
        for si,slot in enumerate(slots):
            for phase in range(3):
                if sum(amps[vi*len(slots)+si] for vi,v in enumerate(vehicles) if phase in v.phases)>(slot.headroom_a or (0,0,0))[phase]:return OptimizationResult('invalid_solver_result',())
        for vi,v in enumerate(vehicles):
            for si,slot in enumerate(slots):
                j=vi*len(slots)+si;a=amps[j];s,e=times[si]
                if a<0 or a>upper[j] or (a and a<v.minimum_a):return OptimizationResult('invalid_solver_result',())
                energy=factors[j]*a;totals[vi]+=energy
                if a:output.append(PlannedCurrent(v.asset_id,s,e,a,energy,energy*slot.price.variable_rate()))
            if not v.required_input_kwh<=totals[vi]<=v.maximum_input_kwh:return OptimizationResult('invalid_solver_result',())
        return OptimizationResult('optimal',tuple(output))
