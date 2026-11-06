# SPDX-License-Identifier: AGPL-3.0-only
# EV arbitration responsibility adapted from EnergyWizard smartbox/gpm.py.
# See NOTICE.md/COPYING. No household globals, fixed 60/40 split or device I/O.
from dataclasses import dataclass
from typing import Sequence
from .session_binding import SessionBinding,BindingStatus

@dataclass(frozen=True)
class CurrentRequest:
    tenant_id: str
    site_id: str
    asset_id: str
    binding: SessionBinding
    phases: tuple[int,...]
    minimum_a: int
    maximum_a: int
    policy_rank: int

@dataclass(frozen=True)
class CurrentDecision:
    tenant_id: str
    site_id: str
    asset_id: str
    session_id: str
    current_a: int
    reason: str

def allocate_current(requests: Sequence[CurrentRequest], headroom_a: tuple[int,int,int] | None, *, tenant_id: str, site_id: str) -> tuple[CurrentDecision,...]:
    """One snapshot, strict caller-supplied policy rank (lower first), ID tie-break.

    Equal ranks do not imply fairness. This is not the future LP/MILP schedule,
    persisted capacity reservation, phase-switching protocol or control authority.
    Caller validates live binding, fresh telemetry, consent and device minima.
    """
    if not tenant_id or not site_id:raise ValueError('Trusted scope required')
    if headroom_a is not None and (len(headroom_a)!=3 or any(type(x) is not int or x<0 for x in headroom_a)):
        raise ValueError('Three nonnegative integer phase budgets required')
    if len({r.asset_id for r in requests})!=len(requests):raise ValueError('Duplicate vehicle request')
    connectors=set()
    for request in requests:
        if (request.tenant_id,request.site_id)!=(tenant_id,site_id):raise PermissionError('Request scope mismatch')
        if not request.asset_id or not request.phases or len(set(request.phases))!=len(request.phases) or any(type(p) is not int or p not in (0,1,2) for p in request.phases):raise ValueError('Verified phase indexes required')
        if any(type(x) is not int for x in (request.minimum_a,request.maximum_a,request.policy_rank)) or not 0<request.minimum_a<=request.maximum_a or request.policy_rank<0:raise ValueError('Explicit valid capability and policy required')
        if request.binding.status==BindingStatus.BOUND:
            if request.binding.vehicle_asset_id!=request.asset_id:raise PermissionError('Binding vehicle mismatch')
            key=(request.binding.evse_asset_id,request.binding.connector_id)
            if key in connectors:raise ValueError('Connector requested more than once')
            connectors.add(key)
    remaining=list(headroom_a or (0,0,0));output=[]
    for request in sorted(requests,key=lambda r:(r.policy_rank,r.asset_id)):
        amps=0;reason='session_unconfirmed'
        if request.binding.status==BindingStatus.BOUND:
            reason='headroom_unknown' if headroom_a is None else 'insufficient_phase_capacity'
            available=min(request.maximum_a,*(remaining[p] for p in request.phases))
            if headroom_a is not None and available>=request.minimum_a:
                amps=available;reason='allocated_by_policy_rank'
                for phase in request.phases:remaining[phase]-=amps
        output.append(CurrentDecision(tenant_id,site_id,request.asset_id,request.binding.session_id,amps,reason))
    return tuple(output)
