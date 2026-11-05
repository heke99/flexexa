# EnergyWizard dashboard under migration

Decision recorded 2026-11-05 following the user's implementation request.

Preserve the original EnergyWizard dashboard and source snapshot during migration. Do not delete or overwrite the existing Flexexa public site or administration.

The dashboard is a reference and candidate source for reusable charging views, not the canonical backend. Any reused source must have verified provenance and applicable licence terms before copying.

Daily customer controls belong in Gridex and other partners' apps. Flexexa owns the API and integrations. Partner support and company administration belong in the Flexexa partner portal; platform administration belongs in its admin portal.

Evaluate dashboard elements for reuse: vehicle selection, SOC and departure settings, charging timeline, current charging status, session history, connection health, and itemized estimated cost. Route every adopted view through canonical Flexexa APIs and permission checks. Do not carry over single-household authentication, global settings, direct Home Assistant calls or local database access.

Any hosted original-dashboard demonstration must be separately protected, clearly labelled as a reference, and have hardware commands disabled. It is optional and has not been deployed by this change.

The implementation checkout starts from phase/0-foundation at 8913e997d889c78c1c657c09d0095a8807a4e7f8. The dashboard preservation decision does not certify completion of optimizer, API, provider or physical tests. Follow SMARTCHARGING_PARTNER_APP_PILOT_2026-11-05.md for the implementation sequence.
