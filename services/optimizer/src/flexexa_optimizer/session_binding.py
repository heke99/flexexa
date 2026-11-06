# SPDX-License-Identifier: AGPL-3.0-only
# Adapted allocation responsibility from EnergyWizard Open smartbox/ev_handshake.py.
# See ../../NOTICE.md and COPYING. No guessed defaults or persistent control grants.
"""Conservative decisions for an already-authorized current-session snapshot."""
from collections import Counter
from dataclasses import dataclass, replace
from datetime import datetime, timedelta
from enum import StrEnum
from typing import Sequence
from .observation_health import Observation, assess_observation
from .charging_goals import _utc


class IdentitySource(StrEnum):
    PROVIDER = 'verified_provider'
    CUSTOMER = 'authenticated_customer_confirmation'


class BindingStatus(StrEnum):
    BOUND = 'bound'
    DISCONNECTED = 'disconnected'
    UNKNOWN = 'unknown'
    CONFLICT = 'conflict'
    UNUSABLE = 'unusable'


@dataclass(frozen=True)
class SessionObservation:
    tenant_id: str
    site_id: str
    session_id: str
    evse_asset_id: str
    connector_id: str
    connected: bool | None
    observed_at: datetime | None
    received_at: datetime | None
    vehicle_asset_id: str | None = None
    identity_source: IdentitySource | None = None
    evidence_session_id: str | None = None


@dataclass(frozen=True)
class SessionBinding:
    session_id: str
    evse_asset_id: str
    connector_id: str
    vehicle_asset_id: str | None
    status: BindingStatus
    reason: str


def resolve_session_bindings(sessions: Sequence[SessionObservation], *, now: datetime,
                             tenant_id: str, site_id: str, max_age: timedelta,
                             allowed_vehicle_ids: frozenset[str],
                             allowed_connectors: frozenset[tuple[str, str]]) -> tuple[SessionBinding, ...]:
    """No credential, identity signature, DB lock or write-authority verification.

    Caller verifies evidence, consent, canonical ownership and allowed sets, and
    supplies current sessions only. Conflicts fail closed for every contender;
    iteration order never awards the first car a charger. Future control requires
    durable transactional fencing and a fresh recheck at dispatch.
    """
    _utc(now)
    if not all(isinstance(x, str) and x.strip() for x in (tenant_id, site_id)):
        raise ValueError('Trusted tenant/site scope required')
    if not isinstance(max_age, timedelta) or max_age <= timedelta(0):
        raise ValueError('Positive max_age required')
    if len({s.session_id for s in sessions}) != len(sessions):
        raise ValueError('Duplicate session ID')
    decisions = []
    for session in sessions:
        if not all(isinstance(x, str) and x.strip() for x in (session.session_id, session.evse_asset_id, session.connector_id)):
            raise ValueError('Canonical session and connector identifiers required')
        if type(session.connected) not in (bool, type(None)):
            raise ValueError('connected must be boolean or unknown')
        if session.identity_source is not None and not isinstance(session.identity_source, IdentitySource):
            raise ValueError('Unsupported identity source')
        health = assess_observation(Observation(session.tenant_id,session.site_id,session.evse_asset_id,
                                    'connector_connected',session.connected,session.observed_at,session.received_at),
                                    now=now,tenant_id=tenant_id,site_id=site_id,max_age=max_age)
        if (session.evse_asset_id, session.connector_id) not in allowed_connectors:
            raise PermissionError('Connector is not authorized for this site')
        if session.vehicle_asset_id is not None and session.vehicle_asset_id not in allowed_vehicle_ids:
            raise PermissionError('Vehicle is not authorized for this site')
        status, reason = BindingStatus.UNKNOWN, 'vehicle_identity_unconfirmed'
        if not health.usable:
            status, reason = BindingStatus.UNUSABLE, health.reason
        elif session.connected is False:
            status, reason = BindingStatus.DISCONNECTED, 'connector_disconnected'
        elif session.vehicle_asset_id is not None and session.identity_source is not None:
            if session.evidence_session_id == session.session_id:
                status, reason = BindingStatus.BOUND, 'session_identity_confirmed'
            else:
                reason = 'identity_evidence_for_other_session'
        decisions.append(SessionBinding(session.session_id,session.evse_asset_id,session.connector_id,
                                       session.vehicle_asset_id if status == BindingStatus.BOUND else None,status,reason))
    # Any contradictory non-disconnected snapshot on one connector blocks all of
    # its contenders, including unknown/stale evidence. Refresh/reconcile first.
    occupancy = Counter((s.evse_asset_id,s.connector_id) for s,d in zip(sessions,decisions)
                        if d.status != BindingStatus.DISCONNECTED)
    vehicles = Counter(d.vehicle_asset_id for d in decisions if d.status == BindingStatus.BOUND)
    for i, decision in enumerate(decisions):
        if decision.status == BindingStatus.DISCONNECTED:
            continue
        reason = None
        if occupancy[(decision.evse_asset_id,decision.connector_id)] > 1:
            reason = 'multiple_current_sessions_on_connector'
        elif decision.vehicle_asset_id is not None and vehicles[decision.vehicle_asset_id] > 1:
            reason = 'vehicle_assigned_to_multiple_connectors'
        if reason:
            decisions[i] = replace(decision,vehicle_asset_id=None,status=BindingStatus.CONFLICT,reason=reason)
    return tuple(decisions)
