# Flexexa delivery acceptance addendum V1.1

Date: 2026-09-18
Status: implementation requirements; NOT implementation acceptance or partner approval.
Baseline: `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`, unchanged.
Baseline SHA-256: `5b1f7abdbff8c291082f9b48be5a1713ac910098898dc654115a13c82b7d687e`.

## Authority, scope and build order

This versioned addendum makes existing V1 requirements testable. It neither replaces
V1 nor deletes, renumbers, skips or approves any of its 88 sections or 14 phases.
In a conflict, retain the stricter safety/tenancy invariant and obtain an explicit
reviewed plan amendment; never silently reinterpret the locked baseline.

The active implementation remains on `phase/0-foundation`; the aggregate PR to
`main` is separate. At the reviewed snapshot `f1e5c231e0fe5da40050ed2a50bb8cef6844bba8`,
Phase 0 was not accepted. The public web shell on `main` at
`df59d718869b152b72c15723f871c1078b0380ae` is not a live device-control product.
These are dated repository observations, not a fresh assertion of cloud state.

Build one complete flow, not parallel implementations:
canonical customer/site/asset -> consent and binding -> fresh observations -> safe
charging -> availability and reservation -> partner instruction -> measured delivery
-> reconciled settlement -> operator/customer view.
Keep Vercel UI, AWS control, Supabase transactions, ClickHouse telemetry, RabbitMQ,
Valkey, S3, central Kernel rules and deterministic local electrical safety as in V1.
Enode remains optional and replaceable; first-party OCPP/OEM support remains required.
Flexexa is BRP-aware, not BRP. Do not make Bixia or any provider the canonical model.

The delivery slices below are NOT new phase numbers:

| Slice | Existing V1 phase | Deliverable and exit boundary |
| --- | --- | --- |
| Foundation | 0 | Finish existing identity/policy/runtime/security/recovery gates on a reconciled version. |
| Real charging | 1 | Full existing Phase 1 scope, with one agreed physical test flow proven end to end. A narrow test does not approve all providers. |
| Required progression | 2 and 3 | Preserve full Swedish true cost and Connect expansion; do not skip them to call a BSP pilot complete. |
| Flex shadow | 4 | Availability, eligibility, reservations, MockBspAdapter, M&V and shadow settlement; no real bids or money. |
| Partner pilot | 5 | An agreed partner/product/resource scope, verified integration and all required external approvals. |
| Remaining roadmap | 6 through 13 | Unchanged; this addendum is not a reason to remove later scope. |

Design and simulator preparation can occur early under V1's existing sandbox rule.
Real device writes, market writes and payouts each require their own explicit gate.
No commercial deadline, resource count, API, minimum bid, response SLA or revenue
percentage is approved by this document. Agree those per pilot/product and version them.
Do not build an exclusive Bixia fork before a buyer and integration contract exist.

## How to use this acceptance catalogue

Each FXP requirement maps to existing masterplan sections/phases and has acceptance
case IDs. These are test specifications, NOT existing tests or passed evidence.
`ci` means automated verification; `physical` means measured real-device evidence;
`operations` means actual deployed operational verification; `partner` means reviewed
external acceptance for the named partner/product/scope. Never substitute a simulator
for physical evidence or a fabricated partner response for external approval.

Record implementation paths, canonical contracts, migrations, consumer impact,
executed test names, environment, immutable source/artifact hashes and reviewer in
an evidence package. Store private customer data, credentials and signed agreements
outside this public repository; commit only a sanitized reference and content hash.
The coverage register is `docs/progress/delivery-acceptance-coverage.json`.
The offline validator checks records and hashes, not whether a remote test or approval
really happened. Review actual runs and source artifacts before recording evidence.

### FXP-01 — Foundation and source parity
Sections: 3, 77, 78, 79, 83
Phases: 0
Depends on: none

Use one source candidate for application, database, generated contracts, infrastructure
and review. Preserve immutable applied migrations. Read existing BUILD_STATUS and
phase-0 handoffs before implementing; reconcile superseded observations explicitly.
No green frontend, source catalogue or isolated container substitutes for hosted gates.

- FXP-01-T1 [ci]: Clean replay, schema catalogue and generated-contract comparison detect deliberate drift; no historical migration is silently rewritten.
- FXP-01-T2 [ci]: Two-tenant negative tests, denied writes, idempotency and unchanged baseline inventory pass on the same candidate; an unverified point keeps plan readiness false.
- FXP-01-T3 [operations]: Verify actual deployment/version, least-privilege connectivity, liveness, alerts, backup recovery and rollback in the declared environment; record unresolved Phase 0 gates rather than approving them from CI.

### FXP-02 — Resource onboarding and consent lifecycle
Sections: 18, 36, 37, 39, 49, 82
Phases: 1
Depends on: FXP-01

Keep connection status, technical control readiness and product-specific market
eligibility separate. Show the exact blocking reason and remediation owner.
Registered -> authorized -> discovered -> fresh observations -> control tested is a
technical workflow, not a shortcut to prequalification. Recheck ownership, environment,
consent scope/expiry and capabilities inside the command transaction and before send.

- FXP-02-T1 [ci]: Valid scoped onboarding succeeds; missing/revoked/expired consent, wrong tenant, wrong asset and sandbox credentials in production fail before any external write.
- FXP-02-T2 [ci]: Revocation while a command waits in a queue prevents its later dispatch; unknown observations are not converted to zero, false or an online state.
- FXP-02-T3 [physical]: Demonstrate one real agreed connection from authorized discovery to timestamped telemetry and controlled actuation; retain device/provider/version and measurement evidence.

### FXP-03 — One physical flexibility source, multiple observations
Sections: 3, 35, 36, 37, 39, 51
Phases: 1, 4
Depends on: FXP-02

Model the temporal relationship between vehicle, EVSE connector, session, site and
metering point without replacing canonical asset IDs. Multiple provider bindings can
observe the same physical load. An explicit verified mapping defines the accounting
and control boundary; do not deduplicate by untrusted VIN text, GPS proximity or name.
Unknown/ambiguous mapping excludes commercial aggregation rather than guessing.
Keep a single write authority with fenced ownership per physical session. Read failover
must not silently become write failover; a second controller needs a safe handover.

- FXP-03-T1 [ci]: Vehicle and EVSE feeds for the same session produce one capacity contribution and one active control authority, including concurrent discovery and reconnects.
- FXP-03-T2 [ci]: Plug migration, old-session events, provider failover and delayed ACKs cannot transfer ownership incorrectly, resurrect a revoked route or double-count energy.
- FXP-03-T3 [ci]: Unknown relationships are excluded; ordinary tenants cannot link another tenant's asset. Authorized platform aggregation preserves source ownership and an audit trail.

### FXP-04 — Safe commands and measured outcomes
Sections: 2, 38, 39, 45, 54, 79
Phases: 1, 4
Depends on: FXP-03

Separate requested, authorized, sent, provider-acknowledged, observed and completed
states. A successful HTTP/ACK is not verified physical delivery. Persist idempotency,
expiry, causation, policy version and control fencing. Retries, fallback and redispatch
must respect the same physical reservation/authority and product constraints.
Hard electrical/site limits always win and are never optional business preferences.
Customer mobility/override follows V1; an interrupted commitment creates an incident,
partner notification and conservative remaining availability, not hidden success.
Recovery includes bounded ramp/rebound planning rather than restarting all loads at once.

- FXP-04-T1 [ci]: Duplicate commands, crash/retry, timeout, stale policy, expired messages and out-of-order ACKs cannot cause repeated or late actuation; failures remain explicit.
- FXP-04-T2 [ci]: Safety/site limits, customer overrides and infeasible departure targets constrain the plan; lost telemetry/connection triggers documented fallback and disables unsupported commitments.
- FXP-04-T3 [physical]: Measure pause/reduction and recovery on the declared device; verify response time, actual power and mobility outcome, including a command ACK with no measured response.
- FXP-04-T4 [ci]: Competing control routes and simultaneous recovery requests cannot exceed site limits or reuse capacity already committed elsewhere.

### FXP-05 — Conservative, explainable capacity and reservations
Sections: 35, 46, 47, 49, 50, 51, 79
Phases: 4
Depends on: FXP-04

Report nominal, technically available, conservative safe, reserved and remaining
capacity per interval, direction, duration and product. Explain exclusion/derating.
For V1G, reduced consumption is not grid export; increase is bounded by feasible
charging headroom. Store baseline/forecast method, input ages, uncertainty and version.
Do not label a percentile statistically calibrated without a calibration/backtest.
Use atomic reservations against the physical boundary, including overlapping products,
energy/rebound constraints and site headroom; validate again when accepting a commitment.
UTC intervals remain unambiguous through Swedish daylight-saving transitions.

- FXP-05-T1 [ci]: Disconnected/fully charged vehicles, stale telemetry, infeasible departure, negative headroom and uncertain identity cannot inflate available capacity; kW/kWh/sign conventions are explicit.
- FXP-05-T2 [ci]: Concurrent reservations and retries cannot oversubscribe shared physical/site capacity; cancellation and partial acceptance release only the applicable reservation.
- FXP-05-T3 [ci]: Backtest availability against held-out observations; report error/calibration and exclusions rather than just registered-device count. Test interval boundaries and DST repeats/gaps.

### FXP-06 — Replaceable BSP boundary and partner permissions
Sections: 18, 55, 56, 57, 60, 78, 82
Phases: 4, 5
Depends on: FXP-05

Use the existing BspProvider abstraction and canonical schemas, then implement one
agreed partner adapter. Bixia API transports, fields, credentials and response SLAs
remain unconfirmed until documented by the partner. A proposed endpoint is not a live
integration. MockBspAdapter must run the same internal lifecycle without real market writes.
A partner sees authorized pools/periods/aggregates by default; raw PII/VIN/location
requires explicit purpose and permission. No blanket cross-tenant partner role.
Credentials and signed webhook verification include rotation, scope, timestamp,
replay protection and idempotency; revocation is re-evaluated on queued work.

- FXP-06-T1 [ci]: Simulator covers accepted/rejected/partial/duplicate/late activations, network loss, malformed input and corrections through the real canonical handlers.
- FXP-06-T2 [ci]: Wrong tenant/pool/environment, bad signature, replay, revoked credentials and unauthorized raw data access fail without external effects or data leakage.
- FXP-06-T3 [partner]: Verify the selected adapter against partner-approved contracts/test endpoint and documented expected results; record actual partner acceptance without claiming it from mocks.

### FXP-07 — Time-correct eligibility and external prerequisites
Sections: 49, 50, 59, 60, 81
Phases: 4, 5
Depends on: FXP-06

Version product rules with source, effective interval, review date, responsible owner
and approval evidence. Eligibility uses the resource's retailer/BRP/BSP/DSO/market-area
relationships at delivery time, consent and applicable unit/group prequalification.
Technical, market and commercial readiness are separate decisions with reason codes.
Future multi-BRP/direct-BSP models stay disabled until the applicable model is verified.
Historical actor changes must not rewrite past eligibility, delivery or settlement.
The BRP relationship described by the user is NOT a Flexexa BSP agreement.

- FXP-07-T1 [ci]: Missing/expired qualification, incompatible BRP/BSP/area, unavailable rule version and absent partner agreement deny the market action while valid scoped combinations pass.
- FXP-07-T2 [ci]: A supplier/actor change inside a delivery window splits or rejects the affected interval correctly; replay preserves original decisions and rejects conflicting overlaps.
- FXP-07-T3 [partner]: Confirm the selected product, unit/group, metering method, applicable actor model and required agreements/approvals for this pilot before enabling market writes.

### FXP-08 — Measurement, baseline and verifiable delivery
Sections: 37, 53, 54, 61, 80
Phases: 4, 5
Depends on: FXP-07

Keep requested, acknowledged, measured, verified and externally settled quantities
separate. Store provenance, event/receipt time, quality, units, interval, baseline,
optimizer/policy versions and correction lineage. Missing telemetry is not requested
power and must not silently become delivered power. Corrections append new versions.
Separate the commercial comparator against existing smart charging from the
product-specific delivery baseline. Never count the same shifted energy twice as profit.

- FXP-08-T1 [ci]: Duplicate/out-of-order/missing measurements, counter resets, wrong units and clock/interval errors cannot create unsupported delivered energy or overwrite evidence.
- FXP-08-T2 [physical]: Replay an actual measured activation from command to verified interval quantities; show that ACK-only/no-response stays unverified and shortfall is reported.
- FXP-08-T3 [partner]: Obtain acceptance of the delivery/baseline/data-quality method for the named product and measurement boundary; a commercial ROI model is not market M&V approval.

### FXP-09 — Reconciliation and contract-driven economics
Sections: 61, 62, 63, 64, 65, 79, 80
Phases: 4, 5
Depends on: FXP-08

Trace each amount through agreement version, statement/line, delivery interval,
activation, physical source, measurement and calculation version. Keep estimated,
verified and partner-settled results separate. Only approved reconciled amounts may
reach the payout path. Imports and corrections are idempotent, with balanced ledger
entries and traceable reversals, rounding, tax/currency and discrepancy handling.
Software licence and operated flexibility service are distinct agreement models.
BSP deductions, other costs and customer/retailer/Flexexa shares have explicit bases,
order, validity and caps. Never hardcode one revenue percentage for all contracts.
Report buyer margin after customer rewards, BSP costs and software/operating costs.

- FXP-09-T1 [ci]: Duplicate statement/line imports and retry/concurrent posting have one durable financial result; unbalanced entries or unsupported currency/unit combinations fail atomically.
- FXP-09-T2 [ci]: Partial settlement, penalties, disputes, corrections and rounding preserve source lineage and balance; estimated revenue cannot trigger a payout.
- FXP-09-T3 [ci]: Different agreement versions/licence models reproduce correct allocation without double-counting savings; historical contract changes do not alter already posted records.

### FXP-10 — Operator workflow, pilot evidence and release decision
Sections: 55, 56, 61, 62, 71, 75, 77, 78, 80, 83
Phases: 5
Depends on: FXP-09

Build one operator workflow from available resources and exclusions through commitments,
active control, deviations, verified delivery and economics. Display provenance and
whether each value is simulated, estimated, measured or settled. Tenant and partner
views share canonical data, not separate dashboard calculations.
Before pilot start, name the buyer, technical owner, operations owner and acceptance
reviewer; agree resource recruitment, device/provider scope, KPIs, measurement duration,
response limits, support, rollback, data retention/export and stop conditions. Pricing
and resource counts require a scoped proposal, not assumptions from a sales conversation.
The pilot compares against the incumbent workflow and reports onboarding effort,
connection quality, actual response, mobility outcomes, shortfalls and net buyer value.
Use a limited rollout with a tested stop switch and incident escalation. Expired external
approvals trigger re-evaluation; no plan-status checkbox authorizes a live command.

- FXP-10-T1 [ci]: Browser/API/data E2E shows one coherent flow, explicit exclusions and simulated/estimated/measured/settled labels; unauthorized viewers cannot control or approve settlement.
- FXP-10-T2 [operations]: Exercise deployed observability, provider outage, operator stop, queue recovery, rollback and retained audit evidence for the selected pilot scope.
- FXP-10-T3 [partner]: Record the agreed pilot entry criteria and final buyer/technical acceptance or rejection using measured results; commercial interest alone is not acceptance.

## Required change/evidence procedure

Before each implementation batch, read V1 plus this addendum, run plan:check and the
codebase index/impact flow, and map every changed invariant to FXP cases and existing
source points. Add failing regressions before fixing behaviour. Extend existing
canonical models/RPCs instead of introducing duplicated provider-specific models.

For schema changes: migration -> clean replay -> RLS/negative-tenant/concurrency checks
-> actual schema readback -> contract/type regeneration -> consumer/API/UI tests.
For control changes: add timeout/replay/fencing/fallback tests and measured device proof.
For money changes: add duplicate/concurrency/reversal/debit-credit proofs.
For partner changes: add contract tests, sanitized payload fixtures and partner review.
A batch does not close because its happy path, lint or static schema is green.

Publish a scoped PR, run ordinary CI on the final SHA, inspect required checks and
review findings, and merge through the applicable review/protection rules. Do not
self-certify independent review, skip checks, rewrite migration history, force push
protected branches or use infrastructure changes to unblock a documentation task.
Refresh source-parity and scoped runtime/external evidence after relevant changes.
Do not claim main/production completion from a PR merged only into foundation.

The existing plan:check also validates this catalogue and its coverage register.
The existing plan:ready requires BOTH V1 and this addendum to be recorded ready on
an unchanged, clean source snapshot. It remains false while any required evidence
is missing. This is recorded-evidence integrity, not an automated legal/safety approval.
Plan integrity passing never changes a product requirement to verified.

## External facts and unresolved partner decisions

Primary sources reviewed 2026-09-18; revalidate effective rules before delivery:

- Svenska kraftnat BSP information: https://www.svk.se/aktorsportalen/leverantor-av-balanstjanster-bsp/
  The page currently states BSP must also be BRP at the delivery point. Keep actor
  rules versioned and fail closed; do not assume a future independent model is active.
- Svenska kraftnat prequalification: https://www.svk.se/aktorsportalen/bidra-med-reserver/forkvalificering/
  Approval concerns the unit/group and reserve product; our connection test is not it.
  The BSP remains responsible for its subcontractor and relevant IT-security work.
- Bixia flexibility: https://bixia.se/foretag/energilosningar/flex
  Describes technical-aggregator collaboration; it does not publish a Flexexa API
  contract, confirm Bixia's willingness to buy Flexexa or grant us market access.

Partner discovery must settle buyer vs reseller vs market-provider roles, incumbent
integration coverage, resource access, responsibility, data permissions, accepted
measurement/baseline, interface/security, costs and the exit-to-production decision.
No private agreement contents, customer PII or credentials belong in this repository.
