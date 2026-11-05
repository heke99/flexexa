# SPDX-License-Identifier: AGPL-3.0-only
# Adapted goal-resolution responsibilities from EnergyWizard Open smartbox/decisions.py.
# Upstream: https://github.com/murre87/energywizard ; see ../../NOTICE.md and COPYING.
# Flexexa adaptation, 2026-11-05: explicit inputs, scoped immutable results, Decimal,
# aware UTC deadlines, no implicit morning floor, no I/O or device commands.
"""Resolve customer intent into energy demand, before mathematical optimization.

This does not allocate site power, verify electrical safety or establish that a
vehicle is controllable. The authenticated caller must resolve trusted scope and
fresh canonical observations before constructing inputs.
"""
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from decimal import Context, Decimal, ROUND_HALF_EVEN, localcontext
from enum import StrEnum
from typing import Mapping
from zoneinfo import ZoneInfo


class GoalStatus(StrEnum):
    DISABLED = 'disabled'
    UNKNOWN = 'unknown'
    SATISFIED = 'satisfied'
    NEEDS_CHARGE = 'needs_charge'
    EXPIRED = 'expired'


def _number(value: Decimal, name: str, low: Decimal, high: Decimal | None = None) -> None:
    if not isinstance(value, Decimal) or not value.is_finite() or value < low or (high is not None and value > high):
        raise ValueError(f'Invalid {name}')


def _utc(value: datetime) -> datetime:
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError('Timezone-aware datetime required')
    return value.astimezone(UTC)


@dataclass(frozen=True)
class GoalInput:
    # Internal service input, not a replacement for shared canonical API models.
    tenant_id: str
    site_id: str
    asset_id: str
    enabled: bool
    target_soc_percent: Decimal
    departure_at: datetime | None
    current_soc_percent: Decimal | None
    battery_capacity_kwh: Decimal | None
    charge_efficiency: Decimal | None
    finish_margin: timedelta = timedelta(0)


@dataclass(frozen=True)
class GoalDemand:
    tenant_id: str
    site_id: str
    asset_id: str
    status: GoalStatus
    reason: str
    target_soc_percent: Decimal
    departure_at: datetime | None
    planning_deadline_at: datetime | None
    required_battery_energy_kwh: Decimal | None
    required_input_energy_kwh: Decimal | None


def evaluate_goal(goal: GoalInput, *, now: datetime, tenant_id: str, site_id: str) -> GoalDemand:
    """Pure adaptation of EnergyWizard's get_car_plan_details/full_charge_deadline.

    No 60 kWh battery fallback, 12% multiplier, 50% morning floor or implicit
    deadline. Unknown input stays unknown. A positive demand is not a feasibility
    verdict: site/phase/capability constraints belong to the optimizer/control.
    """
    current_time = _utc(now)
    if not all(isinstance(v, str) and v.strip() for v in (tenant_id, site_id, goal.tenant_id, goal.site_id, goal.asset_id)):
        raise ValueError('Non-empty scoped identifiers required')
    if goal.tenant_id != tenant_id or goal.site_id != site_id:
        raise PermissionError('Goal scope does not match trusted execution scope')
    if type(goal.enabled) is not bool:
        raise ValueError('enabled must be boolean')
    _number(goal.target_soc_percent, 'target SOC', Decimal(0), Decimal(100))
    if goal.current_soc_percent is not None:
        _number(goal.current_soc_percent, 'current SOC', Decimal(0), Decimal(100))
    if goal.battery_capacity_kwh is not None:
        _number(goal.battery_capacity_kwh, 'battery capacity', Decimal('0.000001'))
    if goal.charge_efficiency is not None:
        _number(goal.charge_efficiency, 'charge efficiency', Decimal('0.000001'), Decimal(1))
    if not isinstance(goal.finish_margin, timedelta) or goal.finish_margin < timedelta(0):
        raise ValueError('Non-negative finish margin required')
    departure = _utc(goal.departure_at) if goal.departure_at is not None else None
    deadline = departure - goal.finish_margin if departure is not None else None

    def result(status, reason, battery=None, supplied=None):
        return GoalDemand(goal.tenant_id, goal.site_id, goal.asset_id, status, reason,
                          goal.target_soc_percent, departure, deadline, battery, supplied)

    if not goal.enabled:
        return result(GoalStatus.DISABLED, 'customer_disabled', Decimal(0), Decimal(0))
    if departure is None:
        return result(GoalStatus.UNKNOWN, 'missing_departure')
    if deadline <= current_time:
        return result(GoalStatus.EXPIRED, 'planning_deadline_passed')
    if goal.current_soc_percent is None:
        return result(GoalStatus.UNKNOWN, 'missing_soc')
    if goal.current_soc_percent >= goal.target_soc_percent:
        return result(GoalStatus.SATISFIED, 'target_already_met', Decimal(0), Decimal(0))
    if goal.battery_capacity_kwh is None:
        return result(GoalStatus.UNKNOWN, 'missing_battery_capacity')
    if goal.charge_efficiency is None:
        return result(GoalStatus.UNKNOWN, 'missing_charge_efficiency')
    with localcontext(Context(prec=28, rounding=ROUND_HALF_EVEN)):
        battery = (goal.target_soc_percent - goal.current_soc_percent) / Decimal(100) * goal.battery_capacity_kwh
        supplied = battery / goal.charge_efficiency
    return result(GoalStatus.NEEDS_CHARGE, 'energy_required', battery, supplied)


@dataclass(frozen=True)
class WeeklyDeparture:
    local_time: time
    target_soc_percent: Decimal
    # Repeated local hour must have an explicit fold: 0 first, 1 second.
    fold: int | None = None


@dataclass(frozen=True)
class ResolvedDeparture:
    departure_at: datetime
    target_soc_percent: Decimal


def next_weekly_departure(schedule: Mapping[int, WeeklyDeparture], *, now: datetime,
                          timezone: str) -> ResolvedDeparture | None:
    """ISO weekday keys 0=Monday; empty schedule has no invented default.

    Ambiguous/nonexistent future wall times fail explicitly, so the caller can
    request a customer/policy decision rather than silently moving a deadline.
    """
    current_time = _utc(now)
    zone = ZoneInfo(timezone)
    for weekday, rule in schedule.items():
        if type(weekday) is not int or weekday not in range(7):
            raise ValueError('Weekday must be integer 0..6')
        if not isinstance(rule.local_time, time) or rule.local_time.tzinfo is not None:
            raise ValueError('Naive local time required')
        if rule.fold is not None and (type(rule.fold) is not int or rule.fold not in (0, 1)):
            raise ValueError('fold must be 0 or 1')
        _number(rule.target_soc_percent, 'scheduled target SOC', Decimal(0), Decimal(100))
    for offset in range(8):
        date = current_time.astimezone(zone).date() + timedelta(days=offset)
        rule = schedule.get(date.weekday())
        if rule is None:
            continue
        wall = datetime.combine(date, rule.local_time)
        candidates = []
        for fold in (0, 1):
            aware = wall.replace(tzinfo=zone, fold=fold)
            utc = aware.astimezone(UTC)
            if utc.astimezone(zone).replace(tzinfo=None) == wall:
                candidates.append((fold, utc))
        unique = {candidate for _, candidate in candidates}
        if not unique:
            raise ValueError('Nonexistent local departure time')
        if max(unique) <= current_time:
            continue
        if len(unique) > 1 and rule.fold is None:
            raise ValueError('Ambiguous local departure time; choose fold')
        selected = next((utc for fold, utc in candidates if fold == (rule.fold or 0)), None)
        if selected is not None and selected > current_time:
            return ResolvedDeparture(selected, rule.target_soc_percent)
    return None
