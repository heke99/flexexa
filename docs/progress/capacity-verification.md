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

## Lokalt HTTP-prov med PostgreSQL

Verifikationsskriptet startar en ny loopback-bunden PostgreSQL-instans per scenario och kör samtliga SQL-migreringar från vald checkout av `charging-subscription`. Det använder checkoutens låsta Node-beroenden och Python från arbetarmiljön med paketen i `workers/fleet-planner/requirements.txt`. Kör som en vanlig lokal användare.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --seconds 5
```

Skriptet anropar det ordinarie autentiserade HTTP-API:t med `SupabaseAuth`. En lokal svarsstub för `/auth/v1/user` accepterar enbart de syntetiska testtoken som skriptet skapar. API:t använder riktiga approller och PostgreSQL:s radbehörighet. Körningen skapar 12 000 fordon och två kontrollfordon, traverserar samtliga 120 sidor och jämför med den befintliga listan i vardera fördelningen. Under fordonsläsning köas planering för hela flottan, och en förares ena tilldelning återkallas via HTTP medan den andra förblir läsbar. Kontrollerna omfattar dessutom korsade konton och pekare, obehörig planering, idempotent omförsök och ersättning av ett äldre jobb. Den verkliga arbetaren kör den pinnade lösaren och resultatet läses via samma konto-API.

Varje mätintervall testar första sidan med 100 fordon för ägar- och ekonomiroller. Standardläget schemalägger fem sekunder vardera vid 100 och 300 anrop/s. Normalintervallet delar resurser med planeringen och återkallelsen. Mätningen räknar från schemalagd begäran till läst svar, inklusive klientens lokala väntan och JSON-avkodning. Utdata inkluderar statuskoder, tappade testanrop, observerad tid, p95/p99, avstämda resursantal och om det korta mätintervallet nådde föreslagna gränser. Kör `--legacy-list` för att mäta den befintliga opaginerade listvägen. Den har fortsatt stöd för klientanrop utan queryparametrar.

Den 22 november 2026 kördes provet mot `charging-subscription` vid `5fd99f4922d1c3b4361420c755d034549719ee96` med PostgreSQL 18.6, Node 24.19.0, NumPy 2.5.4 och OR-Tools 9.15.6755. Samtliga 37 migrationsfiler spelades upp i båda klustren. Det blev totalt 4 000 lyckade listanrop utan oväntade fel, tappade anrop eller främmande fordonsrader. Traversering av 120 sidor i varje fördelning gav samma fordon i samma ordning som den befintliga listan.

| Fördelning | 100 anrop/s p95 / p99 | 300 anrop/s p95 / p99 | Beständig mottagning p95 för planjobb | Arbetarens tid för hela flottan |
| --- | --- | --- | --- | --- |
| 12 företag | 68,9 / 174,2 ms | 6,1 / 14,4 ms | 292,5 ms över 12 första jobb | 2,323 s över 12 jobb efter ersättning av det första |
| Ett företag | 37,2 / 79,7 ms | 8,5 / 45,2 ms | 139,8 ms för ett första jobb | 1,353 s för ett jobb efter ersättning av det första |

En tidigare integrerad körning på `986d990` pågick samtidigt som andra verifieringar i samma miljö. Det fördelade scenariot hade p95 över 4,9 sekunder i båda mätintervallen och testklienten nådde taket på 400 samtidiga anrop. Det koncentrerade scenariot hade p95 på 1 430,1 respektive 601,3 ms. Båda avstämningarna av fordonsåtkomst och planjobb passerade. Skillnaden mellan körningarna gör att driftens mätgränser behöver bedömas i en separat, reproducerbar lastmiljö.

En separat sekund per belastningsnivå med `--legacy-list` visade att opaginerad listning överskred 500 ms p95 i båda fördelningarna redan vid 100 schemalagda anrop/s. Vid 300 anrop/s i det koncentrerade scenariot svarade 199 av 300 anrop med HTTP 500. Företagsvyer som ska användas för stora flottor behöver den avgränsade listvägen.

Det lokala provet täcker delar av R51, R52 och R56. Återstående miljöprov omfattar full historik, fysisk laddning, klientbyggen och deras cache, betalnings- och webhooktrafik, beroendekvoter, fasgränser, driftens resursprofil och hela tidsprofilen för lasttest.

## Lokalt telemetriprov R53

Lägg till `--telemetry` för att prova den befintliga simulatoradaptern, arbetarrollen och uppdateringen av aktuell status i båda fordonsfördelningarna. Samma loopback-server används för autentiserad uppdatering och HTTP-läsning. Använd `--telemetry --skip-reconnect` för ett kort utvecklingsprov.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --seconds 5 --telemetry
```

Provet matar syntetiska avläsningar genom den befintliga adaptervalideringen och den riktiga statusuppdateringen i PostgreSQL. Det kör 230 schemalagda avläsningar/s tillsammans med listning, planjobb och återkallelse, följt av 600/s tillsammans med sidvis fordonsläsning. Återanslutningsvågen omfattar ytterligare 12 000 avläsningar under en minut ovanpå 230/s. Den avgränsade toppens längd styrs av `--seconds`. Återanslutningsvågen har en fast minut enligt [lastprofilen](capacity-profile.v1.json).

Välj `--scenario concentrated` för alla 12 000 fordon i ett företag eller `--scenario distributed` för 12 företag. Välj `--phase normal`, `--phase peak` eller `--phase reconnect` för en enskild fas. Med `--peak-seconds 600` kör toppfasen de föreskrivna tio minuterna med den paginerade fordonslistan och syntetiska telemetriobservationer. Kör belastningsprovet utan annan pågående lokal CPU-belastning. HTTP-server, databas och lastgenerator delar resurser i den lokala miljön.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --scenario concentrated --phase peak --peak-seconds 600 --telemetry
```

Med `--metered-observations` har 3 000 av fordonen mätkapaciteten `read_energy` och en egen stabil mätarepok. Det fyller även det partiella indexet för mätarhistoriken. Provet jämför historikens antal rader med mätarepoker och kontrollerar epoken i skuggstatus och API-läsning. Grundläget använder syntetiska observationer där mätarepoken saknar värde.

HTTP-provet verifierar att en identisk version kan upprepas, att en sen version och en motsägande upprepning avvisas och att en felaktig leverantörsidentitet aldrig skrivs. Förare och främmande konton saknar åtkomst. Därefter stämmer provet av sista version, mättidpunkt och lagrade kumulativa Wh mot skickade avläsningar per fordon, samt läser tillbaka den senast lagrade statusen via konto-API:t. Telemetritiden mäts från schemalagd avläsning till beständigt skuggvärde. En fullständigt genomförd körning återger slutresultat för båda fördelningarna i JSONL.

Den 22 november 2026 kördes båda fördelningarna mot `charging-subscription` vid `4cfcfcf8bf49428f4ab33ee31e28f1634b7c09bf` på PostgreSQL 18.6 och Node 24.19.0. Alla 29 950 schemalagda avläsningar per fördelning skrevs utan fel eller tapp, inklusive 13 800 normala avläsningar och 12 000 återanslutningar i minutprovet. Samtliga 12 000 skuggvärden per fördelning och den kumulativa mätarsumman 2 384 225 619 Wh matchade syntetiskt facit. Tabellen visar p95 från planerad avläsning till beständigt skuggvärde.

| Fördelning | 230 avläsningar/s + blandad last | 600 avläsningar/s + 300 listanrop/s | 12 000 återanslutningar + 230 avläsningar/s |
| --- | --- | --- | --- |
| 12 företag | 13,3 ms | 6,5 ms | 1,5 ms |
| Ett företag | 185,5 ms | 470,2 ms | 16,5 ms |

Alla 4 000 anrop till den paginerade fordonslistan lyckades med rätt konto under det korta blandade provet. När samtliga fordon tillhörde ett företag gav 300 listanrop/s samtidigt med 600 avläsningar/s en p95 på 778 ms för fordonslistan. Det överskred den föreslagna R51-gränsen på 500 ms.

Ett uppföljande femsekundersprov i en ledig lokal miljö på `01724850a6daf23e5b63b5d61dab55acfc7373e8` gav 8,5 ms p95 för listan i det koncentrerade scenariot och 8,9 ms i det fördelade. Den första sidans SQL-plan använde `vehicles_account_plate_id_idx` och tog 0,384 ms i ett separat instrumenterat prov. Instrumenteringen mätte 1,90 ms p95 inklusive SQL-rundtur för fordonsfrågan och 1,82 ms väntetid p95 på databasanslutning i listtjänsten. En fordonsläsning gjorde 36 SQL-anrop över två autentiserade transaktioner. Händelseslingans belastning var 62 procent och p95-fördröjningen 10,6 ms. Det lokala uppföljningsprovet återskapade ingen isolerad flaskhals i fordonsfrågan.

Ett instrumenterat tvåsekundersprov på `6147b61472ff34c8ca492537019be24582ec4ace` pågick samtidigt som andra lokala processer. Det koncentrerade scenariot gav 1 341,9 ms p95 för listan. P95 för väntan på anslutning var 667,6 ms i åtkomstkontrollen och 675,5 ms i listtjänsten. Själva fordonsfrågan tog 5,49 ms p95 inklusive rundtur och testklientens schemalagda fördröjning till avsändning var 14,9 ms p95. Händelseslingans belastning var 91,9 procent och 11 av 1 200 telemetriobservationer nådde testets kötak. De höga svarstiderna sammanföll med väntan i den gemensamma poolen på tio anslutningar. Resultatet motiverar isolerad lokal mätning och särskild uppföljning av väntetid och resursfördelning i lastmiljön.

Använd `--profile-http` vid felsökning för intervall, faktisk avsändningsfördröjning, SQL-plan och fasprofiler för kontoåtkomst, fordonsfråga och poolväntan. Varje steg behåller högst 4 096 latensmätningar för percentiler. Antalet anrop och summan av tider omfattar alla anrop. Kör tidsjämförelser med samma instrumenteringsläge.

På revisioner med den simulerade telemetrihistoriken verifierar provet också att den äldre avläsningen sparas, att en identisk upprepning lämnar en rad och att en motsägande upprepning saknas i historiken. Antal, summor och versioner i historiktabellen stäms av per konto. Prov på äldre revisioner visar aktuell skuggstatus med `history.available=false`. Leverantörsingång, avräkning av sessionsenergi och fysisk mätning återstår för R53.

### Tiominuterstopp

På `charging-subscription` vid `46cf79002b628940067c0bd389cd101578a23e7e` spelades 41 migreringar upp på PostgreSQL 18.6. Båda körningarna den 22 november 2026 använde 12 000 fordon, två separata kontrollfordon, den gemensamma poolen med tio anslutningar och testklienten utan SQL-profileraren. Den fördelade körningen använde `--scenario distributed --metered-observations` med samma fas och varaktighet som kommandot ovan.

| Mätning | Ett företag | 12 företag |
| --- | --- | --- |
| Körtid, svensk tid | 12.32–12.42 | 12.44–12.54 |
| Fordon med mätarepok | 0 | 3 000 |
| Fordonslistan vid 300 anrop/s i 600 sekunder | 180 000 av 180 000 med HTTP 200. P95/p99 7,9/28,0 ms. | 180 000 av 180 000 med HTTP 200. P95/p99 8,1/26,7 ms. |
| Telemetri vid 600 observationer/s i 600 sekunder | 360 000 av 360 000 beständiga. P95 1,3 ms till beständigt skuggvärde. | 360 000 av 360 000 beständiga. P95 1,4 ms till beständigt skuggvärde. |
| Aktuell status och historik | 12 000 avstämda värden och 360 003 historikrader. | 12 000 avstämda värden och 360 003 historikrader, varav 90 003 med mätarepok. |

Vardera datamängden matchade 13 500 042 000 syntetiska kumulativa Wh. Samtliga listanrop gällde första sidan med 100 poster. Båda körningarna gav noll tappade anrop, oväntade fel eller främmande fordonsrader. Tre förkontrollrader ingår i historiken. Den sena observationen bevarades, den identiska upprepningen lagrades en gång och den motsägande upprepningen uteslöts.

Detta verifierar ett avgränsat lokalt topprov för sidvis listning och simulatorobservationer. Den lokala poolgränsen på tio används även av `src/main.mjs`. `deploy/lambda.mjs` och `src/energy-api-runtime.mjs` begränsar respektive instans till en anslutning. Instansskalning, TLS över nät och full Supabase-sessionsverifiering ligger utanför den lokala mätningen med en gemensam pool och syntetisk identitetsrespons. Lastmatrisen för samtidiga klienter, driftprofil och fysiska leverantörer återstår.

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

Den lokala kontrollen verifierar syntetisk testdatagenerering, profilens mål och HTTP-provet ovan. Sex regressionstester passerade med Node 24.19.0. Strömmande generering verifierade 8 760 000 sessionsrader för vardera full fördelning och 730 000 för snabbscenariot. Körbevis för komplett driftlik last, återhämtning, avtalade kvoter och fysisk styrning är öppna. Ansvar för uppföljningen och den integrerade revisionen följer [projektstatus](../PROJECT_STATE.md).

Skill-routing i denna leverans. Repots `verification` och `observability` styr bevis och mätpunkter. Supabase- och PostgreSQL-färdigheterna tillämpas på autentiseringsadaptern, migreringsreplay och radbehörigheter i det lokala HTTP-provet. Webbläsar-, infrastruktur- och driftsättningsfärdigheterna tillämpas i motsvarande klient- och miljöprov.
