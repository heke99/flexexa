# Energy Wizard build-spec review and public contract repair

Owner supplied Flexexa_Energy_Wizard_byggspec.md and asked for the best build
sequence. It is product input, not evidence that its proposed operations or
physical integrations already work. The implementation plan is recorded in
charging-subscription/docs/verification/ENERGY_WIZARD_STAGE_ONE_2026_11_13.md.

First deliverable is a separate portal advisory mode using the existing AWS
queue/OR-Tools API, with real managed Supabase login and server-checked ownership
for one/two cars across two isolated test customers. Simulator controls stay
separate. Market-reference prices are not asserted as customer retail cost,
manual estimates are not verified telemetry, and planning kWh are not meter or
billing evidence. Do not send production account IDs into the sandbox namespace.
The existing raw calculation API is not proof of vehicle ownership or control.

Physical BMW330e/charger acceptance, subscription measurement and Grid Rewards
delivery follow as separate slices. Existing approved net-share configuration
and home-reimbursement decisions remain authoritative. No physical integration,
customer credit, signup, identity data change or advisory-portal completion is
claimed by this documentation repair.

Confirmed defect: public/openapi/partner-offers-v1.json was malformed JSON and
omitted v5 renewal-binding/timezone/terms-URL catalogue fields. Rebuilt the static
OpenAPI3.1 document with resolvable catalogue/offer schemas, canonical www host,
explicit public security and current404 response. Endpoint/catalogue behaviour
is unchanged; this fixes partner consumers' ability to read the contract.

Verification: all77 quality/tool tests and24 domain/API tests pass, including a
regression that parses the actual served source and checks catalogue fields,
refs and immutable term links. Typecheck and Next.js build pass. A fresh local
production-server HTTP test reads/parses the public document and actual catalogue,
checks every offer field is documented and verifies unknown-partner404. No UI
component changed, so this increment needs no new visual interaction assertion.
Skills: existing Next.js and verification overlays; no Supabase schema, control
or financial-policy mutation. The new owner request for an extra10SEK/kWh on
withdrawal is held as a separate unapproved proposal in the subscription repo,
with legal basis/VAT unresolved; accepted customer terms are unchanged.
