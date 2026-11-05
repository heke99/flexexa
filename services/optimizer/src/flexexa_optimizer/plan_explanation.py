# SPDX-License-Identifier: AGPL-3.0-only
"""Language-neutral reasons for retailer UI; never invent a completion promise."""
from dataclasses import dataclass
from .charging_goals import GoalDemand,GoalStatus
from .current_allocation import CurrentDecision

@dataclass(frozen=True)
class PlanExplanation:
    asset_id: str
    goal_status: str
    reason_codes: tuple[str,...]
    proposed_current_a: int
    departure_feasibility: str = 'not_evaluated'
    physical_charging_verified: bool = False

def explain_goal_current(goal: GoalDemand, decision: CurrentDecision) -> PlanExplanation:
    if (goal.tenant_id,goal.site_id,goal.asset_id)!=(decision.tenant_id,decision.site_id,decision.asset_id):raise PermissionError('Goal and current decision scope mismatch')
    if goal.status!=GoalStatus.NEEDS_CHARGE and decision.current_a>0:
        raise ValueError('Cannot propose charging for disabled, unknown, expired or satisfied goal')
    return PlanExplanation(goal.asset_id,goal.status.value,(goal.reason,decision.reason),decision.current_a)
