# Optimizer: first EnergyWizard adaptation

Scope: resolve a customer's explicit charging target into battery/input energy
and UTC deadlines. This is the first porting slice of decisions.py, not a charging
allocator, LP/MILP solver, hosted API, device controller or completed V1 phase.
No dashboard or provider code is changed. Python 3.11+ standard library only.
See NOTICE.md and COPYING for the adaptation's licence/provenance.

## Run

From repository root:

    corepack pnpm test:optimizer

Run corepack pnpm demo:optimizer for a two-car synthetic energy-demand example,
including an isolated target change for car A. No interval plan is produced yet.

The root pnpm test also executes these tests. No database, network, secrets,
external dependencies or physical equipment are used.

## Boundary

An authenticated caller constructs GoalInput from canonical Flexexa models and
fresh observations. The passed trusted tenant/site must match the goal. This guard
is not authentication, SQL RLS, ownership proof, consent or device capability
verification. The caller must not trust scope from a request body.

GoalDemand is an internal immutable service result, not a second published schema
or replacement for packages/domain and packages/api-contracts. Canonical API and
SQL integration will be reviewed in a later slice together with their consumers.

Energy is battery capacity times SOC difference, then divided by explicitly given
charge efficiency. No automatic 60 kWh battery, 12% losses, 50% morning floor or
one-hour full-charge margin is inferred. Unknown observations remain unknown.
Disabled charging creates no implicit morning schedule. Finish margins are explicit;
a margin consuming the time budget is reported expired rather than silently dropped.
Positive energy demand is not a verdict that it can be met before departure.

next_weekly_departure uses weekday 0=Monday and an IANA timezone. All returned
instants are UTC. An empty schedule returns None. Repeated local times need an
explicit fold; nonexistent local times fail for a caller/customer decision. They
are never silently shifted or deduplicated. This policy is tested for Stockholm.

## Verification and continuation

Tests cover energy/efficiency, unknown values, disabled/low goals, deadlines and
margins, numeric validation, separate assets, cross-scope rejection and both DST
transitions. No RLS, hosted provider, hardware or price-saving result is claimed.

V1 scope: sections 35, 44, 45, 78, 83. V1.1 references: FXP-04-T2 and FXP-05-T3 for scoped time-boundary preparation.
The tests are preparatory software evidence, not acceptance of either full case.

Next slices: scope/freshness-aware observations and vehicle/charging-point session
binding; mathematical multi-vehicle planning constrained by site/phase limits;
canonical cost inputs and traceable interval output; API and dashboard integration;
provider consent/control and physical pilot. Preserve central Kernel authority.

Skill routing: repository index, impact, affected verification, test strategy,
code review and security review. No DB/IAM/live deployment/provider changes.

## Reviewed observation/session primitives

observation_health.py assesses source timestamps with explicit maximum age and clock
tolerance. session_binding.py accepts already-authorized current-session observations
and allowed canonical IDs; it never guesses a car from an active plug or previous
allocation. Both are pure and AGPL-3.0-only adaptations; see NOTICE.md and the targeted
review at docs/reviews/energywizard-python-2026-11-05.md (from repository root).
These decisions do not establish signatures, authentication, durable write authority,
physical identity proof, freshness persistence or runtime readiness on their own.
