# Flexexa smart-charging dashboard preview

Standalone, original HTML/CSS/JS design preview. No EnergyWizard source was copied.
The source dashboard is preserved unchanged. The design uses dark evergreen navigation,
a light workspace, lime accents, an original vehicle illustration and responsive cards.

## Open

In the Flexexa Next.js app: /previews/smartcharging/index.html
Static review deployment: https://flexexa-nqfdoefuw-div3rsa.vercel.app/

This is a frontend preview, not a connected charging product. The BMW model label and
all battery values, prices, tax/network examples and energy requirements are synthetic.
They are not verified BMW specifications or a current tariff quotation.

## Working interactions

- Vehicle selection with separate in-session saved targets and departure times.
- Charge-target slider and departure time update the illustrative graph and costs.
- Saving retains the selected vehicle preferences for this page session only.
- Electricity-only versus electricity/network/tax cost breakdown.
- Garage, history and installation views.
- Connection and Charge Now dialogs explain the future connection without sending commands.

No network calls, tokens, auth simulation, browser persistence, provider control,
API endpoints or database writes are implemented. Do not add real data here without
the existing partner authorization and canonical Flexexa API boundary.
The three-hour price-selection example is for visual interaction only; it is not
the V1 optimizer, a physically feasible charging plan or an evidence-backed savings claim.
The displayed component costs are rounded to cents before summation; fixed fees and
uncomputed demand charges are explicitly excluded.

## Verification and continuation

Recorded locally: JavaScript syntax check, masterplan/catalogue integrity, immutable
migration-history checks and the repository affected-verification application suite.
Browser review exercised vehicle selection, target changes/save and cost view switching.
The isolated static Vercel preview is separate from the production Flexexa site.
Full application verification does not mean physical charging or backend integration passed.

Routing: sites guidance for UI preparation/local preview; repository index, impact,
affected-verification, test-strategy and differential-review rules. No schema, policy,
AWS infrastructure, live provider integration or TSX components changed; the related
migration/provider/React review workflows are outside this preview scope.

Next: render canonical plan/status/cost results in retailer-branded views; add hosted
Connect only for onboarding; keep company support and platform administration scoped
to their respective roles. Preserve demo labels until actual integration is verified.
