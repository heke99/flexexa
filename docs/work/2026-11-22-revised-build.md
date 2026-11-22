# Reviderad byggordning 2026-11-22

[Beställd byggordning](../FLEXEXA_REVISED_BUILD_ORDER_2026-11-22.md) · [Projektstatus](../PROJECT_STATE.md) · [Baslinje](../progress/revised-baseline.md)

**Releasebedömning — röd.** Den lokala integrationsgrenen har bevis för avgränsade kund- och företagsflöden. Betalning, fysisk laddning, marknadsavräkning och systemlast har ännu öppna acceptansgrindar.

## Integrationsordning

Produktkod för portal, mobil, API och arbetare utgår från den revision som den bifogade planen granskar, `charging-subscription` main `c26766f`. Auditbranchens bevis används för spårbarhet till de 93 fynden. Auditbranchen kräver en egen verifierad integration. Projektstatus och webbkontroller utgår från `flexexa` main `37aec07`, som Vercel vid inventeringen rapporterade som aktiv webbproduktion. Lokala ändringar ligger på `codex/flexexa-revised-plan` i respektive repo.

Samordnaren äger sammanförandet, flottkontraktet `fleet-plan.mjs` och solverprovet. Åtkomstspåret äger partner-/API-kontrakt och återkallelse. Ekonomispåret äger beräkning, underlagsreservation och sena tillägg. Laddspåret äger pilotprovet och bevis för simuleringen. Legacyspåret äger baslinjetester och Gridex-återhämtning. Kapacitetsspåret äger testprofil och generator. Baslinjespåret äger driftens läsbevis, källor och Startkit-inventeringen. Ekonomimigration 038 går före åtkomstmigration 039. Auditbranchens migrationer 032–037 behåller sina nummer.

Aktiverade skills för samordningen är repots `verification` och `deployments-cicd`, upstream `vercel:verification` och `full-e2e-verification`. `turborepo` lästes under baslinjekontrollen och lades åt sidan efter att senaste main bekräftade rotprojektet. Databas-, ekonomi- och behörighetskontroller följer deluppdragens relevanta profiler och lokala instruktioner.

## Körda kvalitetsgrindar

| Kodläge och miljö | Kontroll | Utfall |
| --- | --- | --- |
| flexexa `37aec07` + lokala ändringar, Node 24.19.0 | `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run plan:check`, `npm run verify:web:source` | Godkända. V1-registret har bibehållen integritet och öppen produktberedskap. |
| flexexa, samma lokala produktionsbygge | `CHROMEDRIVER=<lokal chromedriver> npm run test:web:http` | Godkänt. Chromium 151, 1440 och 390 px, noll JavaScript-fel och ingen horisontell overflow. |
| flexexa, Engineering Startkit 3.0.0-projektkontroll | `python3 tools/engineering/check_standard.py --project . --mode project` | 0 fel. Verktyget har en generell varning för automatisk upptäckt av den kompletterande agentfilen. |
| charging-subscription `c26766f`, separat lokal baslinje | `npm test`, native PostgreSQL 18, webbsyn, Vite, Chromium med fixtures och med native API/databas, mobil lint/typkontroll/osignerad Expo-export | 353 backend, 12 native, 116 portaltester, 102 Chromium med fixtures och 42 fullstack-Chromium godkända. Expo-export lyckades för iOS, Android och webb. |
| charging-subscription, samordnad R52/R46-version `7439a73` | `node --test test/fleet-plan.test.mjs test/fleet-plan-database.test.mjs test/charging-pilot.test.mjs` och `python3 -m unittest discover -s workers/fleet-planner -p 'test_*.py'` | 5 Node och 4 Python godkända med pinnade solverberoenden. |
| charging-subscription `e575c04`, offline, OR-Tools 9.15.6755 och NumPy 2.5.4 | `python3 scripts/quality/verify-fleet-solver.py --charging ../charging-subscription` från Flexexa med de låsta solverberoendena | 12 000 fordon, 84 platser och 96 kvartar per körning. Alla plats- och fordonsgränser samt energibalansen stämde mot oberoende facit. Fördelad flotta, koncentrerad flotta och omplanering vid ändrat pris/ändrade avresetider tog 0,901, 0,782 respektive 0,784 s i beräknaren. |
| charging-subscription, sammanförd gren `fe78ce1` | `npm test`, `npm run test:native`, riktade native-prov för företags- och legacydelegering, Rewards och arbetarruntime | 369 backendtester och 17 prov mot isolerad PostgreSQL 18 godkända. De fyra specialproven kördes var för sig i tom `charging_test`. |
| charging-subscription, samma gren | `npm --prefix web run check`, `npm --prefix web test`, `npm --prefix web run build`, `npm --prefix web run test:browser`, `npm --prefix web run test:stack` | 119 portaltester, 106 Chromium-prov med fixtures och 44 Chromium-prov mot HTTP och isolerad native PostgreSQL godkända. |
| charging-subscription, samma gren | `npm --prefix mobile run lint`, `tsc --noEmit` från mobilroten, riktade mobilprov och `expo export --platform all` | 16 transport- och mobilprov samt lint och typkontroll godkända. Expo 58 gav preview-exporter för Android, iOS och webb. Chromium provade slutexporten på 390 px med isolerade fixtures. |
| charging-subscription, samma gren | `node scripts/build-energy-partner-openapi.mjs`, diffkontroll, `actionlint` på ändrat arbetsflöde och repots `npm audit`-kontroller för backend, portal och mobil | OpenAPI kunde återskapas byteidentiskt, workflowvalideringen var grön och audit rapporterade 0 sårbarheter inom kontrollerad omfattning. |
| charging-subscription, samma gren, offline | Ny körning av `verify-fleet-solver.py` | Tre godkända omkörningar. Beräkningstiderna var 1,466, 1,600 och 1,000 s. Energibalansen var 119 984 000 Wh begärt, 113 378 347 Wh tilldelat och 6 605 653 Wh ej tilldelat. |

Den första webbrundan stannade när lokal ChromeDriver saknades. Samma ordinarie kontroll passerade efter installation av rätt ChromeDriver-byggserie i temporär katalog. GitHub Actions-annoteringen för PR #26 anger konto-/spendgräns före start av arbetssteget. Det finns lokala prov för den revisionen i [baslinjen](../progress/revised-baseline.md).

## Verifiering av integrerade användarresor

| Prov | Utförd kedja och verifierat utfall | Extern grind |
| --- | --- | --- |
| R42–R43, P0 | Arbetaringång → accepterad policy → verifierad testmätning och tariff → oföränderligt fakturaunderlag → separat sen justering. PostgreSQL 18 spelade upp samtliga migrationer. Åtta samtidiga godkännanden skapade en justering och reserverade källan en gång. Prisprov täcker månads- och kvartspris och momsbeloppet kontrolleras separat. | Faktiskt mätunderlag samt Stripe Sandbox för bokning och kontroll av mottagarens krediter. |
| R45, P0 | Chromium → kundinloggning i isolerad teststack → ordinarie API → begränsad databasroll → företagsmandat → kö och Python → läsning av plan och avtalsstatus. Efter kundens återkallelse nekades första företaget åtkomst och dess väntande jobb stoppades. Den andra relationen och kundens betalda abonnemang fanns kvar. | Verklig OAuth-klient, återkallelse vid webhookleverans och signerad mobilapp på fysisk enhet. |
| R45 i mobil, P0 | Preview-konfigurerad Expo-klient. Kontobyte och utloggning spärrar uppdateringar från ett gammalt anrop. Samma idempotensnyckel och underlag används för oförändrade återförsök. Kontoägaren kan granska och återkalla beviljade scopes. | Installerad build mot avsett Energy API. |
| R46, P0 | Autentiserat HTTP-anrop → ordinarie migreringar → plan → worker → simulator → verifierade 4 kW, paus, återupptagning och totalt 2 000 Wh. Separat Chromiumprov verifierade portalvisning, kontogränser och städning. | Fysisk laddkontroll och mätning på avtalad laddbox. |
| R49, P0 | Chromium och separat HTTP/databasprov. Förlorade svar på order och acceptans återhämtas med stabila nycklar. Proven läser tillbaka väntande order och visar att tidigare köpt period består. | Riktiga Gridex- och betalningstestmiljöer för oberoende avtal och utfall. |
| R52, P1 | Lägg plan via autentiserad API-ingång → beständig plankö → riktig solver → avgränsat resultat. Omplanering ersätter gamla jobb. Separat 12 000-beräkning stämde mot oberoende Wh-facit. | Fysiska fasgränser, verifierad platsindelning och samtidig blandad systemlast. |

Lokala körningar använde Node 24.19.0, Chromium 151, PGlite eller en ny loopback-PostgreSQL 18, migreringar från repot och isolerade syntetiska testidentiteter. Laddsimulatorn rapporterade noll kvarvarande testrader, enheter, simulerade leverantörseffekter och principals efter städning. Inga aktuella ändringar är publicerade i en driftsatt miljö.

## Acceptansmatris

| ID | Lokal täckning och bevis | Grind före godkännande |
| --- | --- | --- |
| R42 | Se ekonomispåret i charging-subscription. | Stäm av verkligt underlag för rätt avtal och mottagare, fakturakredit och sen rättelse i isolerad betalningsmiljö. |
| R43 | Se beräknings- och databastester för pris, partiellt underlag och periodgränser. | Verifiera faktisk mätpunkt och pris-/avtalsversion för pilotmånaden. |
| R44 | Öppet. Jämför sessionsdata, fysisk fordonskoppling och bevarad operatörskostnad. | Välj verifierad metod för delad laddbox och CDR från avtalad operatör. Prova spårbar supportkorrigering. |
| R45 | Se åtkomstspåret och lokala partner-/återkallelsetester. | Gå igenom tilldelning från ordinarie klient, partnerapp och jobb inklusive eventuell webhookleverans och ekonomihistorik. |
| R46 | Lokal simulering av autentiserad kund → plan → kö → syntetisk effekt och ackumulerad energi. [Laddpilot](../progress/charging-pilot.md) | Avtalad laddbox, lokala gränser, mätkälla och upprepade fysiska prov. |
| R47 | Öppet. Befintliga Rewards-fixtures visar endast simulering. | Avtala program, giltighet, aktörsroller och rätt mottagare för sen avräkning. |
| R48 | Öppet. Lastdata omfattar sena CDR och krediter. | Läs ett verkligt partnerformat och stäm av sen/rättad kostnad, marginalperiod och oförändrad faktura där avtalet kräver det. |
| R49 | Se portalen och återhämtning av kombinerat köpförsök. | Matcha separata avtals- och betalningsutfall, återförsök och tidigare förbetalda rättigheter med riktiga testsystem. |
| R50 | Öppet. Befintliga Rewards-vyer och journal använder simulatorn. | Avtalat program samt explicit och verifierad mottagarroll. |
| R51 | Två genererade fulla fordonsfördelningar och 8 760 000 sessioner per fördelning. | Kör ordinarie mobil-, webb-, API-, databas- och bakgrundsflöden samtidigt. |
| R52 | Lokal asynkron beräkning per uppgiven effektgräns, 12 000 resurser i solverprov och ett separat HTTP-/databasprov med två gränser. | Riktiga plats- och fasgränser, serverstyrt platsunderlag, kvoter, flera företag och omplanering under last. |
| R53 | Belastningsscenario för normal last, topp, dubbletter, sena och urordnade händelser samt återanslutning. | Kör tillsammans med systemets telemetriingångar och stäm av accepterade händelser och Wh. |
| R54 | Simulerat laddprov omfattar gammal status och omplanering. Lastprofilen omfattar leverantörsavbrott. | Kör köövertagande under last och verifiera okända utfall hos leverantören före omkörning. |
| R55 | Datasetet omfattar månadsskiften, sena CDR och krediter. | Kör månadsstängning och faktura-/exportflödet mot ett oberoende facit. |
| R56 | Syntetiska rollkombinationer och separata kontrollföretag. | Kör gamla installerade klienter, cache, export och köade jobb med ordinarie roller under last. |
| R57 | Dokumenterade provsteg för migrering och avbrott. | Kör migrering, pausad bakgrundsfyllning, återläsning och extern avstämning i produktionslik testmiljö. |
| R58 | [Pilotprotokoll](../progress/charging-pilot.md) och lokal simulator. | Mät fysisk effekt, kWh och bekräftade partnerkvoter per styrväg. |

## Spårbarhet och externa prov

- R42–R43 berör FX-11 och FX-14. En oanvänd negativ kvart hindrar inte en styrkt positiv kredit. Fakturaförhandsvisningen har en verifierad separat momssummering. Tidigare underlag behåller sina beräkningsversioner.
- R45 berör FX-18, FX-81 och FX-82. Sökning når bilar bortom de första tolv i listan. Medgivandehistorik läses oberoende av partnerkatalogen. Återförsök i öppen portalvy använder samma begäran och idempotensnyckel.
- R49 berör FX-30. Två återförsök efter osäkra svar använder ursprungsordern. Offertversionering, avtalets kommersiella genomförande och extern betalning har egna återstående prov.

Lastprofilens körkommandon och mätgränser finns i [kapacitetsverifieringen](../progress/capacity-verification.md). Fordonskatalogen behöver en dokumenterat tillåten källa per fält och pilotåtkomst för BMW 330e 2023 samt en ren elbil. Prova Enode med båda fordonsvarianterna innan täckning visas i klienten.

Första marknadsprovet behöver en partner och ett program med namngiven leveranspunkt, dokumenterat mandat och bekräftade BSP-/BRP-roller. Inför en eventuell dialog med Bixia behövs avstämning av mätgräns, svarstid, reservation, avvikelsekostnad, kundkompensation och vem som avräknar respektive reglerar. Andelen på 30 procent ligger som kalkylantagande. Produktens lokala prov använde simulerade ladd- och partnerutfall.

## Fortsättning på integrationsgrenen

| Krav | Genomfört och verifierat lokalt | Kvarstående acceptans |
| --- | --- | --- |
| R42–R43 | Godkännande av ett sent energitillägg binder både det stängda månadsunderlaget och exakt granskat prisunderlag. Ändrat spotpris gav avslag före insättning. Åtta samtidiga godkännanden gav en enda justering. | Verkligt mät- och prisunderlag, avstämning och betalningsmiljö. |
| R44, R48 | Worker-CLI sparar Wh, verklighetsnära operatörskostnad och separata fordonsgranskningar. Kortkoppling ger kandidatstatus. Sena, nya och rättade poster räknas en gång i svensk användningsmånad. Två native PostgreSQL-prov kördes med arbetarinloggning. | CDR och avtal från vald operatör, verifierad fysisk fordonsmetod, kundvisning och marginalrapport. |
| R45, R56 | Slutförd delegerad plan och leveranshändelse skrivs i samma transaktion. Partner hämtar minimala händelser genom det befintliga mandatet. Native och Chromium provar två företag samt nekad fortsatt leverans med gammal markör efter återkallelse. | Levande OAuth-integration och avtalad utgående webhook där den behövs. |
| R46, R54, R58 | Förlorad simulatorkvittens avstäms före ny effekt. Ett tidigare utfört kommando kan fortfarande kvitteras efter urkoppling, samtidigt som aktuell status visar 0 kW. Inget positivt kommando sänds igen på gammalt underlag. | Avtalad fysisk laddbox, oberoende mätning, reservläge och längre leverantörsavbrott. |
| R47, R50 | Rewards-simulatorn binder program och leveransställe till leverantör, BRP och giltighetstid. Gamla behörigheter stängs för nya reservationer. En sen korrekt import före återkallelsen går till tidigare konto och period. Nativeprov avgränsar två leverantörsrelationer och ett andra kundkonto. | Verkligt marknadsdeltagande, programgodkännande och reglering till verifierad mottagare. |
| R49, FX-34, FX-89 | Gridexoffert läses tillbaka utan partneranrop. Expirerad offert bevaras i historiken. Samma indata och återförsök behåller offertrevisionen, nya val får en ny revision. Portal och native HTTP verifierade kontogränser. | Separat Gridex-aktivering och Stripe Sandbox för båda avtalen. |
| R51, R52, R56 | Ordinarie paginerad fordonsväg och verklig arbetare provade båda 12 000-fördelningarna i PostgreSQL 18. Företagsportalens billista använder 100 fordon per sida. Sökning omfattar laddade sidor. Täta planresultat på drygt 1,15 miljoner allokeringar gick genom HTTP, kö och solver som cirka 8,12 MB. [Körprotokoll](../progress/capacity-verification.md) | Samtliga gamla klienter, fasgränser, kvoter, full telemetri- och ekonomilast i produktionslik miljö. |
| Steg 2 | Två svenska katalogposter med EEA/CC BY 4.0 reproducerades från källan och tre katalogtester passerade. [Fordonskatalog och pilot](../progress/vehicle-pilot.md) | Bekräftad fordonsvariant, Enode Sandbox, anslutning samt styr- och mätprov på bilarna. |

Den samlade produktrevisionen `7dd2480` passerade 375 backendtester, fyra Node-flottester, fyra Python-flottester, sex energitester, 122 portaltester, 112 Chromium-prov med testdata och 46 Chromium-prov genom HTTP och isolerad PostgreSQL. Dedikerade native-körningar provade 13 gemensamma fall, två CDR-fall samt företagsdelegering, Rewards-byte och begränsad laddarbetare. Databaskontrollerna spelade upp 040–043 i nummerordning. OpenAPI kunde genereras utan diff och det ändrade arbetsflödet passerade actionlint.

Kapacitetsomkörningen på backend `5fd99f4` gav 4 000 lyckade paginerade anrop utan tapp eller kontoläckage. Körningar under konkurrerande lokal belastning överskred tidsmålen. Den opaginerade toppvägen gav 199 HTTP 500 vid ett koncentrerat 12 000-fordonsprov. [Körprotokoll](../progress/capacity-verification.md)

Stripe-anslutningarnas kontolista visade Trafexa Nordic AB i live-läge. Betalningsacceptansen behöver en tillgänglig isolerad sandbox. Programrapporten är fortsatt röd. Lokal återläsning av partnerhändelser och simulerad avräkning har inga externa mottagare.
