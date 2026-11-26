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

## Publicerat och läskontrollerat

Källkod252ce99df82368c3fb8f398b2edfcfe478f436d2, Vercel production
`dpl_53HWwMDvd5mUtZHQtfjxSchXg4G5` READY. flexexa.com och www.flexexa.com
pekar till denna version. Erbjudanden, villkor och partnerlandning svarar200 med
nya regler; offentligt partner-API svarar200 med
flexexa-partner-offers-2026-11-13-v2 och tvåmånaders-/v5-metadata för båda
erbjudandena. Köp är fortfarande false. Länkad v5-PDF på ladda.flexexa.com har
lästs och matchar portalens källbytes; tidigare PDF-versioner är bevarade.

Portalens motsvarande production dpl_61nRwv4R9W31i8vYyyBeh58pd8eZ är READY
på källkod d509b19. Sandbox API/worker är uppdaterade och hälsokontrollerade;
produktionsbackends schema/katalog och kommersiella spärrar ändrades inte.
Visuell kontroll här är Chromium mot det identiska lokala produktionsbygget;
publik efterkontroll är TLS-verifierad HTTP/API/asset-kontroll, ingen påstådd
ny inloggad kundsession. Ingen delningslänk, skyddsförsvagning eller kundskrivning
behövdes för publiceringen.

## Versionerad publicering av erbjudanden

Webbens prisjämförelse och partner-API läser samma release i `src/domains/partner-offers/releases/`. V2 återger Commerce-villkoren v5 från `d509b1907b2771c6cc185dc9a1925440919dcee7`. Giltighetsdagen avser svensk tid. Ordinarie pris och Gridexrabatt lagras i ören. Det villkorade priset och minsta fasta kostnad för första bindningstiden beräknas från releasen.

En ny godkänd prisversion läggs i en ny fil med en giltighetsdag och en referens till det granskade Commerce-underlaget. Välj den sedan uttryckligen i `publication.ts` med versionsnummer och SHA-256 för JSON-objektet. Tidigare releasefiler och villkorslänkar bevaras. Partner-API:t ger 503 utan cache om den valda releasen saknas som giltigt underlag. Bygg och verifiera en ny webbversion när den ska börja visas.

Katalogen visar tillgänglighet för aktuell publicering. Commerce avgör om köp är tillåtna och sparar pris, villkor och policy på varje order. Kör `COMMERCE_OFFER_SOURCE_DIR=/sökväg/till/charging-subscription node --test test/partner-catalog.test.mjs` för att stämma av releasebelopp och avtalsfält mot den fastnålade Commerce-revisionen.
