# Five-part charging implementation — 2026-11-05

Scope: additive preparation for V1 §§35–45,69,78,83 and V1.1 FXP-04-T2/T4,
FXP-05-T3. This is software/simulation evidence only; no full acceptance case,
phase, physical capability or production release is approved.

1. **Interval planning:** EnergyWizard decisions/GPM planning responsibilities
   adapted into a bounded integer-amp MILP using SciPy/HiGHS. Explicit per-vehicle
   energy bounds, departure windows, min/max current, fixed connector/phase mapping,
   shared phase headroom and interval prices. Decimal post-validation rejects
   unsafe solver output. Solver timeout/nonoptimal/infeasible yields no schedule.
   This optimizes known variable energy cost only, not dynamic demand charges,
   solar/flex commitments, phase switching, fairness or dispatch reservations.
2. **Cost projection:** explicit energy price, retail margin, network transfer,
   energy tax and VAT; missing peak charge remains unknown. Estimated variable
   cost and electricity-only views, no invented full total or fixed-fee allocation.
3. **API:** shared strict response parsers and HTTP read-server factory. Separate
   company and privileged/audited platform backend interfaces; canonical IDs,
   rejection of extra/leaking fields, cross-tenant response rejection, admission
   limits and bounded waits. Local HTTP tests cover authorization with two synthetic
   tenants. The production JWT/RBAC/RLS/audit adapter is intentionally still absent.
4. **Company portal:** multiple simulated cars and one blocked point, searchable
   list, detail with computed interval currents and explicit cost uncertainty.
5. **Platform admin:** separate aggregate view of synthetic partner companies;
   no customer-detail projection. Preserved the approved customer dashboard as a
   separate preview. Both views are public demos, not authenticated portals.

The Python exporter creates the JSON consumed by the preview from the same solver
and cost implementation; the contract suite parses the exported data. It is a
build-time synthetic projection, not a browser-to-production-API integration.

Review routing: index/impact, test strategy, code/security review, nextjs, browser,
deployment and full application verification. DB/IAM/provider mutations are out
of scope. SciPy and NumPy are exact pinned, binary-only, with CPython 3.12 Linux
wheel hashes for CI. Both use permissive BSD licenses; wheel distributions retain
their bundled notices, including HiGHS. No additional optimizer frameworks added.

Remaining production chain: authenticated read adapter + RLS/audit verification;
durable versioned plans/policy/consent/session checks; ECS service deployment;
live tariffs/telemetry; device command fencing and local safety; BMW/charger
capability verification and real pilot. BMW CarData access alone proves no command
support. No physical charging or demonstrated customer saving is claimed.
