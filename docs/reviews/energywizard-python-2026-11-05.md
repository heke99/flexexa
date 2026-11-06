# EnergyWizard Python review and porting disposition

Date: 2026-11-05. Targeted source review, not a full security or hardware certification.
The supplied archive is the reference. Original files are preserved; improvements
are introduced in the Flexexa adaptation with regression tests. See optimizer
NOTICE.md for source hashes and AGPL-3.0-only notice.

| Source | Observed issue / coupling | Disposition |
| --- | --- | --- |
| decisions.py | Hidden morning floor, battery fallback, fixed losses and early finish. Reads household DB/learning/weather and drops repeated local timestamps. | Goal responsibility adapted in PR #60. Explicit inputs, Decimal arithmetic and UTC; full interval planning not ported yet. |
| health.py / SensorWatch | Non-None values refresh last_seen to poll time; cached old data can appear alive. Never-seen sensors do not produce a lost event. | Added pure source-timestamp health assessment. Missing timestamp/value stays missing; cached retrieval does not renew data freshness. |
| health.py / MeterFreeze and load_check | Missing power/phase values can become zero. Constant values are treated as a freeze heuristic. Phase-current load interpretation needs a verified electrical model. | Not reused as electrical proof. New assessment rejects missing/non-finite values; source freshness and provider quality remain distinct from constant-value heuristics. |
| ev_handshake.py | Disconnected/nonempty prior assignments are skipped rather than cleared here. Default car and dictionary order can choose an identity without evidence. | Session-specific confirmation required. Disconnection removes returned association; old-session evidence cannot bind a new session. All conflicting contenders fail closed. |
| gpm.py | Stateful household arbitration mixes cars, HVAC/spa/battery logic, DB access and implicit real-time fallback. | Reviewed relevant EV/control boundaries; extract later with explicit clock and per-site state. No claim of full GPM audit or port. |
| plan_brief.py | Fixed quarter-hour slots, Swedish prose/formatting and local-time assumptions. Missing-price filtering can summarize only a subset of energy. | Later return language-neutral, versioned interval explanations with explicit coverage and cost completeness. Not ported in this slice. |
| timeline.py | Fixed Nissan/Tesla meter mapping, local-wall-time hourly stepping and implicit zero planned energy where no plan value exists. | Later use canonical session/asset identity, UTC intervals and explicit unknown/plan coverage. Not ported in this slice. |

## New software invariants

Observation freshness uses observed_at, not received_at or a process-global last poll.
Zero and false are valid values; None, missing times and NaN/Infinity are not usable.
Expiry is half-open: age >= max_age is stale. Future/inconsistent clock evidence
fails unless an explicit tolerance allows it. Numeric signal ranges remain the
canonical provider/caller's responsibility.

Session binding requires trusted authorized tenant/site, allowed vehicles/connectors,
fresh current-session evidence and explicit identity provenance. Provider labels
and customer-confirmation enums are NOT cryptographic verification; the caller must
verify signatures/session ownership and authenticated customer action first.
Connected flags, preferred-car configuration and prior assignments are not identity.

The resolver is a pure snapshot decision, not a distributed lock or control grant.
A bound result does not prove current consent, electrical safety or command readiness.
Durable ownership, identity evidence lifecycle and revalidation at dispatch remain
mandatory in Connect/control. This code has no network, DB or device side effects.

## Validation scope

Python regression tests exercise stale/unknown/future data, zero and false, invalid
numbers, authorized scope, unplug/reconnect, new-session mismatch, duplicate IDs,
unknown identities and order-independent vehicle/connector conflicts. Root optimizer
tests include the prior goal/DST cases. Application checks are run through the
existing full-risk repository verification. No physical or hosted evidence claimed.

V1: §§35–39,44–45,70,78–79,83. Preparatory software coverage of FXP-02-T2,
FXP-03-T1/T2/T3 and FXP-04-T2; no complete acceptance case is approved here.
No baseline, migrations, provider accounts, dashboard or infrastructure are changed.
