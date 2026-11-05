# Source and license notice

This optimizer package's Python goal-resolution adaptation is licensed under
GNU Affero General Public License v3.0 only (AGPL-3.0-only); see COPYING.
The notice covers this package, not an assertion that other repository components
have been relicensed or that separation automatically exempts a combined work.

Adaptation source: EnergyWizard Open, smartbox/decisions.py,
get_car_plan_details and full_charge_deadline responsibilities.
Upstream authors: EnergyWizard Open contributors, repository murre87/energywizard.
https://github.com/murre87/energywizard

Input snapshot: the user-supplied energywizard-main.zip reviewed in this task.
Source decisions.py SHA-256: 573207986ab30fe6dea43a90a51e4ebe988e5b7e521900e396e606cf1c9ad5f0.
Upstream README declares AGPL-3.0. Its missing archive licence text was recovered
from upstream LICENSE, Git blob 0ad25db4bd1d86c452db3f9602ccdbe172438f52,
https://github.com/murre87/energywizard/blob/main/LICENSE, reviewed 2026-11-05.
The licence document's own copyright is retained verbatim in COPYING.

Flexexa modifications, 2026-11-05: explicit immutable service inputs/results,
trusted tenant/site scope guard, Decimal energy arithmetic, configurable efficiency
and finish margin, no implicit battery size/morning floor, UTC deadlines, explicit
weekly DST ambiguity handling, tests; no Home Assistant/DB/provider I/O.

All source of this adaptation is present in this public repository. Any future
network-served product using it must implement applicable source-offer and other
licence obligations; this unhosted primitive does not settle the licence scope of
a future combined product. Keep notices and licence when redistributing.

Additional responsibility adaptations, 2026-11-05:
- health.py -> observation_health.py: source timestamp freshness, strict values, immutable scoped result.
- ev_handshake.py -> session_binding.py: explicit confirmed identity per current session, no guessing or inherited allocation.

Reviewed supplied-archive source SHA-256 values:
- health.py: ca47e316a6722eb18305151022d8793a7307dffd0d43eeb39be040e9c5fedede
- ev_handshake.py: 13977c52870275e28d70b3cc5311dd3f13319007c178a7c9604829c1fab42412
- gpm.py: 82495b1cb1c01b4a2c9079ed7a57188c8753e8c5aba6373ecedf04a4625a6df1
- plan_brief.py: 38b5f7b9e227181458abfdc1b18cfbf55e73069491de32d67da21672534660ad
- timeline.py: e990040529de9deef3beece4a52cbd9743f0a1027809d9db394a5a5b05c41a83
