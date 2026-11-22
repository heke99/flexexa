# Kapacitetsprov R51–R58

[Lastprofil v1](capacity-profile.v1.json) versionshanterar planens krav på minst 12 000 registrerade och aktiverade fordon och de föreslagna dimensioneringsvärdena från 22 november 2026. Föreslagna värden behöver jämföras med flottmix, pilotevidens och avtalade kvoter. Versionshantera varje justering med underlag och beslutsfattare.

## Lokalt testunderlag

Kör från reporoten. Samma kommando ger samma syntetiska JSONL-rader vid samma profilversion.

```sh
node scripts/quality/capacity-profile.mjs --check
node --test scripts/quality/capacity-profile.test.mjs
node scripts/quality/capacity-profile.mjs quick vehicles > /tmp/flexexa-quick-vehicles.jsonl
node scripts/quality/capacity-profile.mjs distributed principals > /tmp/flexexa-distributed-principals.jsonl
node scripts/quality/capacity-profile.mjs concentrated sessions | wc -l
```

Alla tre datamängderna kan genereras för `distributed`, `concentrated` och `quick`. De två fulla scenarierna har 12 000 fordon, 84 laddplatser av varierande storlek, två simulerade leverantörs-ID:n, privata och företagsägda relationer, 3 000 fordon i laddstatus och en förväntad historik om 8 760 000 sessioner över tolv månader per scenario. I det koncentrerade scenariot har ett företag samtliga fordon och två separata kontrollföretag har olika licenser och testroller. Snabbprovet har 1 000 fordon. Sessionsraderna är strömmande och innehåller Wh, ören, ursprunglig period och sent mottagna CDR-exempel med kreditbelopp.

Fixture-ID:n och roller är logiska testvärden. Läs in dem via en testadapter som skapar vanliga auth-roller, relationer och mandat i tilltänkt lastmiljö. Varje scenario återanvänder syntetiska fordons-ID:n och ska laddas i en egen eller återställd datamängd. Sätt verkliga effekt- och fasgränser per testplats, registrera pågående sessioner och kör den faktiska webb-, mobil-, API- och kötrafiken. Ett sessionsbelopp i fixture är syntetiskt ingångsunderlag. Det oberoende ekonomifacit som används i R55 beräknas från indata, avtal och händelser i det faktiska provet.

## Provmatris

Den publika webbcheckouten på `37aec07` beskriver det separata flottjobbet i [Energy Wizard-underlaget](../work/2026-11-12-energy-wizard-partner-api.md). Samma underlag anger att det syntetiska 5 000-fordonsprovet av solver har en snävare omfattning än lastprovet. Produktionskontraktet för [de tidigare publika planeringsrutterna](../../public/openapi/energy-planner-v1.json) anger att planering och pris kräver produktåtkomst. Bind följande prov till den aktuella privata API-ingången, stödda klientbyggen och de faktiska bakgrundsjobben innan körning.

| Prov | Körning och mätning | Beroende för godkänd acceptans |
| --- | --- | --- |
| R51 | Kör båda fulla fördelningarna med 100 respektive 300 API-anrop/s i normal- och topplast. Kör laddning, app, portal, partner-API, webhook och ekonomijobb samtidigt. Mät p95, p99 samt andel oväntade fel per kritisk rutt, inklusive behörighet och databas. Kör 24 timmars blandad last. | Isolerad miljö med ordinarie klientvägar, riktig rollmodell, representativ historik och mätning vid API-ingången. |
| R52 | Uppdatera priser och många avresetider, följ alla jobb-ID:n till beständigt mottagande och slutlig flottplan. Sätt en leverantörskvot på ett företag. Kontrollera effekt och fas per plats, giltig planversion och kötid för övriga företag. | Flott-API, databas, arbetare, platsgränser och leverantörssimulator. |
| R53 | Kör 230 händelser/s, en topp på 600/s i tio minuter och en separat minut med 12 000 extra återanslutningar. Mata sena, dubbla och urordnade mätningar. Mät från accepterad händelse till aktuell status och stäm av historik och energi. | Telemetriingång, lagrade mätvärden enligt datakontrakt och avläsbar sessionssummering. |
| R54 | Bryt en leverantör, ge okänd kommandokvittens, återkalla mandat, låt ett kommandos tidsgräns gå ut och starta om en arbetare. Kontrollera avstämning före omkörning, köövertagande, kommandospår och tid till normal köålder efter återställning. | Beständig kö, kvotsimulator, statusavläsning och styrgränser. |
| R55 | Stäng en period under blandad last. Jämför faktura, bilspecifikation, export, ersättning, sen CDR, kredit och webhookåterspelning mot ett oberoende facit i Wh och ören. Mät från komplett verifierat underlag till avslutad fakturaperiod. | Testfakturering, avtal och godkänd isolerad betalnings- och webhookmiljö. |
| R56 | Byt företag och roll samt återkalla ett mandat i aktuell och stödd äldre app. Prova läsning, nedladdning, export, cache, händelser och exekvering av redan köade jobb med vanliga klientroller. Stäm av varje avsiktligt nekad begäran. | Stödda klientbyggen, dokumenterad roll- och mandatmatris, flera företag och riktiga sessionsuppgifter i lastmiljön. |
| R57 | Migrera representativ historik. Stoppa och återuppta bakgrundsfyllning. Mät låsväntan och trafikpåverkan. Återställ databasen och stäm av redan skickade externa effekter innan arbetare återupptas. | Samma databasmotor och relevanta inställningar som drift, återställningsunderlag och isolerade externa mål. |
| R58 | Genomför start, paus och återupptagning samt fånga mätt effekt och slutlig kWh för varje styrväg som ska stödjas. Jämför verklig utrustning, observerad kapacitet, avtalad kvot och planerad volym per leverantör. | Avtalad utrustning, behörigt testmandat, leverantörsmiljö och oberoende mätning. |

## Körbevis

Lagra ett redigerat resultat per prov och scenario med `acceptanceId`, `scenario`, `profileVersion`, `startedAtUtc`, `finishedAtUtc`, `revision`, `clientBuilds`, `environment`, `environmentParity`, `command`, `datasetCounts`, `observations`, `artifactReferences`, `outcome` och `openIssues`. Ange om miljön är lokal, simulerad, leverantörstest, driftsatt test eller fysisk pilot. Spara kvot, köålder per jobbtyp och leverantör, databasens låsväntan och anslutningsbelastning, leverantörsanrop, kostnad per aktiv bil, spårade differenser samt relevanta korrelations-ID:n utan verkliga kund- eller fordonsuppgifter.

För R51 jämförs normal- och topplast separat per rutt. Räkna oväntade fel och timeout bland giltiga anrop. Redovisa avsiktliga nekanden och kontrollerade avbrott separat. För jobb skiljs beständigt mottagande, köväntan och resultat från leverantörens kvittens och fysisk effekt. För R53 startar klockan vid mottagen giltig händelse. För R54 startar återhämtningstiden när leverantörsåtkomsten har återställts och fortsatt kvotblockering redovisas separat. För R55 startar tiden vid komplett verifierat underlag. Använd profilens nollgränser för tappade affärshändelser, dubbla verksamhetseffekter, obehörig åtkomst och överskridna platsgränser. Länka provade larm och återställningsförfaranden med uppmätt återställningstid och dataförlust per flöde.

## Status

Den lokala kontrollen verifierar syntetisk testdatagenerering och profilens mål. Sex regressionstester passerade med Node 24.19.0. Strömmande generering verifierade 8 760 000 sessionsrader för vardera full fördelning och 730 000 för snabbscenariot. Körbevis för produktlast, driftlik återhämtning, avtalade kvoter och fysisk styrning är öppna. Ansvar för uppföljningen och den integrerade revisionen följer [projektstatus](../PROJECT_STATE.md).

Skill-routing i denna leverans. Repots `verification` och `observability` styr bevis och mätpunkter. Supabase-, Postgres- och webbläsarverifiering blir aktuella när dataladdaren och ordinarie produktvägar kopplas in i lastmiljön. Infrastruktur- och driftsättningsfärdigheter tillämpas vid motsvarande miljöändring.
