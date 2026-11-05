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
