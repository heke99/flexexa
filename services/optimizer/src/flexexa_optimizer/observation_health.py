# SPDX-License-Identifier: AGPL-3.0-only
# Adapted monitoring responsibility from EnergyWizard Open smartbox/health.py.
# See ../../NOTICE.md and COPYING. No global watch state or provider I/O.
"""Assess source-data age independently from retrieval time and value changes."""
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from enum import StrEnum
import math
from .charging_goals import _utc


class HealthStatus(StrEnum):
    FRESH = 'fresh'
    MISSING = 'missing'
    STALE = 'stale'
    INVALID = 'invalid'
    FUTURE = 'future'


@dataclass(frozen=True)
class Observation:
    tenant_id: str
    site_id: str
    asset_id: str
    signal: str
    value: Decimal | float | int | bool | None
    observed_at: datetime | None
    received_at: datetime | None


@dataclass(frozen=True)
class ObservationHealth:
    status: HealthStatus
    reason: str
    age: timedelta | None

    @property
    def usable(self) -> bool:
        return self.status == HealthStatus.FRESH


def assess_observation(observation: Observation, *, now: datetime,
                       tenant_id: str, site_id: str, max_age: timedelta,
                       future_tolerance: timedelta = timedelta(0)) -> ObservationHealth:
    """Trusted scope must come from authorization, never a request body.

    The caller must validate signal-specific ranges (SOC, phase current, etc.).
    A constant valid reading is not proof of a frozen meter. This is not an
    electrical safety function, link-recovery worker or command authorization.
    """
    if not all(isinstance(x, str) and x.strip() for x in (tenant_id, site_id, observation.tenant_id,
               observation.site_id, observation.asset_id, observation.signal)):
        raise ValueError('Non-empty scope, asset and signal required')
    if (observation.tenant_id, observation.site_id) != (tenant_id, site_id):
        raise PermissionError('Observation scope mismatch')
    if not isinstance(max_age, timedelta) or max_age <= timedelta(0):
        raise ValueError('Positive max_age required')
    if not isinstance(future_tolerance, timedelta) or future_tolerance < timedelta(0):
        raise ValueError('Non-negative future tolerance required')
    current = _utc(now)
    observed = _utc(observation.observed_at) if observation.observed_at is not None else None
    received = _utc(observation.received_at) if observation.received_at is not None else None
    if observation.value is None or observed is None or received is None:
        return ObservationHealth(HealthStatus.MISSING, 'missing_value_or_timestamp', None)
    value = observation.value
    if type(value) not in (bool, int, float, Decimal) or (isinstance(value, float) and not math.isfinite(value)) or (isinstance(value, Decimal) and not value.is_finite()):
        return ObservationHealth(HealthStatus.INVALID, 'non_finite_or_unsupported_value', None)
    if observed > current + future_tolerance or received > current + future_tolerance or observed > received + future_tolerance:
        return ObservationHealth(HealthStatus.FUTURE, 'inconsistent_source_clock', None)
    age = max(timedelta(0), current - observed)
    if age >= max_age:
        return ObservationHealth(HealthStatus.STALE, 'source_value_expired', age)
    return ObservationHealth(HealthStatus.FRESH, 'source_value_current', age)
