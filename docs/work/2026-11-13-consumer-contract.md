# Avtal, uppsägning och ånger — 13 november 2026

Ägarens beslut: nya avtal har två månaders bindningstid i taget, en
kalendermånads uppsägningstid och fortsatt tjänst/betalningsskyldighet fram till
slutdatum. Begäran kan registreras direkt; den förkortar inte bindningstiden.
Äldre accepterade villkor bevaras. Registreringsnummer identifierar avtalet i
portalens order och mottagningsbevis. Distansavtalslagen tillåter inte automatiskt
bortfall av lagstadgad ånger efter en enstaka laddning i ett pågående abonnemang;
användning kan kräva skälig proportionell avräkning.

Berört här: erbjudandesida, partnerlandning, webbplatsens villkor och offentligt
partner-API. Katalog v2 pekar på oföränderlig privat-2026-11-13-v5-PDF och anger
renewal_months=2/renewal_binding_months=2. Köp är fortsatt stängda. Portal/backend,
SQL 027 och bevarade orderversioner dokumenteras i charging-subscription PR14,
docs/verification/CONSUMER_CONTRACT_2026_11_13.md.

Skill-routing: lokala Next.js, React, shadcn, agent-browser-verify och verification;
deployments-cicd för publicering. Ingen ny komponentgrund, klientcache,
autentisering, enhetsstyrning eller databasmigration i marknadsrepot.

Lokala lint-, typ-, 77 kvalitets-/verktygstester, 23 domäntester och Next.js-build
passerar. Produktionens HTTP/assets/negativa routes passerar med --http-only.
Ordinarie WebDriver-ingång nekades av saknad ChromeDriver i denna miljö
(WEB_BROWSER_DRIVER_EXIT); den felrapporten har fått en begränsad diagnosrad.
Separat faktisk Chromium/Playwright-körning mot samma lokala produktionsbygge
passerar erbjudande-FAQ, partnerlandning, villkor och API-katalog i 1440/390 px,
utan sidöverflöd eller konsolfel. Ingen browserkontroll har simulerats grön.
React-granskning: serverkomponenter, stabila listnycklar, semantiska länkar/
FAQ och oförändrade auktoritativa gränser. Inga nya beroenden.

Publicering följer ägarens tidigare uttryckliga instruktion om lokalt CI och
publicering. Hosted GitHub CI är fortsatt blockerat av kontots billing/spend-limit;
inget hosted-resultat har förfalskats. Release-id och publik läskontroll läggs till
efter publicering. Befintliga produktionsvariabler och skydd bevaras.
