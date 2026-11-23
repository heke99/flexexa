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

### Blandad lokal läsning och behörighetsgränser

`--mixed-routes` kör de ordinarie HTTP-vägarna med en fast blandning av fall. Provet använder första och mittersta fordonssidan, registreringssökning med matchande och icke-matchande verifieringsfilter, produktåtkomst och ekonomibehörig läsning av företagets egna order. Partnerspåret registrerar en testintegration och skapar riktiga medgivanden via API för 36 syntetiska privata konton. Varje sådant konto har en delad och en privat bil. Partnerns svar stäms av mot exakt den delade bilen. De 72 extra testbilarna tillhör behörighetsprovet utöver de 12 000 flottfordonen.

De avsiktliga nekandena omfattar ett främmande konto, en pekare för ett annat konto, förarens försök att läsa ekonomi, avsaknad partneridentitet, ett delat åtkomstbevis utanför partnerkontraktet och en obehörig plattformsadministrativ översikt. Det ordinarie statusanropet för plattformsroll verifierar att den vanliga användaren saknar administratörsrollen.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --seconds 1 --mixed-routes --telemetry --skip-reconnect
```

Resultatet redovisar schemalagda anrop, roll, statuskoder, väntade utfall, tapp och avvikelser per fall. P95, p99 och andelen oväntade utfall gäller de giltiga läsvägarna, med schemalagda anrop till respektive väg som nämnare för felfrekvensen. Avsiktliga nekanden redovisas med väntad status och felkod i egna fall. En framgång på en spärrad väg eller en lyckad läsning med oväntat innehåll ger felkod från provet efter att resultaten har skrivits ut. Använd fas- och varaktighetsflaggorna nedan för längre lokala mätningar av samma blandning.

På laddbackenden `e8a63803060019348eae2644cbb8f094dfcd70a0` kördes fem sekunder vardera vid 100 och 300 anrop/s i båda fördelningarna. Provet gav 4 000 av 4 000 väntade HTTP-utfall, inklusive 1 032 exakta nekanden, och inga otillåtna eller oväntade svar. Samtliga sju giltiga vägar klarade svarstidsgränsen vid 100 anrop/s.

| Femsekunderstopp vid 300 anrop/s och 600 simulatorobservationer/s | Ett företag | 12 företag |
| --- | --- | --- |
| Svarstid | Sju av sju läsvägar klarade p95-målet. Sökning hade högst p95 med 103,4 ms. | Samtliga sju läsvägar överskred p95-målet. P95 var 1 256,1–1 665,1 ms, högst för partnerläsning. |
| Simulatorobservationer | 3 000 av 3 000 beständiga. | 2 940 av 3 000 beständiga. Schemaläggaren nådde taket för samtidiga testobservationer. |

Ett separat profilerat tresekundersprov med 12 företag på `dd53cb20e8cb721ad7a7f651c6fef994fbff4a27` gav 900 väntade HTTP-utfall av 900 och 1 800 beständiga observationer av 1 800. Sökningens HTTP-p95 var 405,5 ms. Sökfrågan hade 8,17 ms p95 inklusive SQL-rundtur och söktjänstens poolväntan var 183,3 ms p95. Partnerlistan hade 556,1 ms HTTP-p95, 187,5 ms för poolväntan och 2,56 ms för transaktionslåset. I detta prov var anslutningsväntan större än själva sökfrågan och partnerns låsväntan.

För en lokal jämförelse med samma totala anslutningsbudget, kör `--scenario distributed --phase peak --peak-seconds 5 --telemetry --mixed-routes --profile-http` först med gemensam pool och därefter med `--split-pools`. Delningen reserverar sex anslutningar för API:t och fyra för de schemalagda simulatorobservationerna. HTTP-vägarna och den direkta uppdateringen i API:t fortsätter att använda API-poolen. JSONL visar konfigurationen i `connectionPools` och profileringen redovisar väntan per pool och per kodväg.

Fyra femsekundersprov på samma laddrevision `dd53cb2` gav vardera 1 500 av 1 500 väntade HTTP-utfall och 3 000 av 3 000 beständiga simulatorobservationer. Samtliga läsvägar nådde p95-målet i dessa körningar.

| Körordning | P95 sökning | P95 partnerlista | P95 poolväntan | P95 beständigt skuggvärde |
| --- | --- | --- | --- | --- |
| 1. Gemensam pool | 43,1 ms | 53,2 ms | 8,02 ms gemensam | 12,9 ms |
| 2. Delad 6/4 | 124,2 ms | 148,2 ms | 40,08 ms API, 15,49 ms telemetri | 21,7 ms |
| 3. Delad 6/4 | 39,1 ms | 48,3 ms | 5,53 ms API, 0,03 ms telemetri | 5,6 ms |
| 4. Gemensam pool | 25,3 ms | 23,9 ms | 0,05 ms gemensam | 5,2 ms |

Svarstiden varierade mellan körningarna. Delningen 6/4 gav ingen uppmätt fördel för dessa vägar med den lokala lasten och den fasta budgeten.

Detta är ett avgränsat blandprov av HTTP-kontrakt, behörighet och lokal samtidighet. Driftlik belastning med hela produktmixen och längre uthållighet återstår för R51 och R56.

#### Tiominutersprov av blandade läsvägar

Det fördelade provet kördes på `dd53cb20e8cb721ad7a7f651c6fef994fbff4a27` och det koncentrerade på `132c05e61899f2aacbd07b522577bc2779a11d4d`. Båda använde 43 migrationer i PostgreSQL 18.6, 12 000 flottfordon, 36 privata behörighetskontroller och en gemensam pool på tio anslutningar. Kommandot använde `--phase peak --peak-seconds 600 --mixed-routes --telemetry --metered-observations` med respektive `--scenario distributed` eller `--scenario concentrated`. Alla 180 000 anrop per körning vid 300/s gav väntat utfall, inklusive 46 956 avsiktliga nekanden per körning. Inga anrop föll bort och samtliga svar passerade kontrollerna för roll och kontoinnehåll.

| Läsväg | Anrop per körning | p95 / p99 · tolv företag | p95 / p99 · ett företag |
| --- | ---: | ---: | ---: |
| Första fordonssidan | 31 306 | 7,9 / 21,4 ms | 9,1 / 24,4 ms |
| Senare fordonssida | 31 304 | 11,7 / 27,0 ms | 9,8 / 25,8 ms |
| Filtrerad fordonssökning | 23 478 | 12,7 / 28,8 ms | 52,3 / 66,9 ms |
| Produktbehörighet | 15 652 | 9,0 / 25,2 ms | 14,1 / 27,7 ms |
| Orderläsning | 7 826 | 8,4 / 24,1 ms | 15,2 / 29,7 ms |
| Delegerad partnerläsning | 15 652 | 10,0 / 26,9 ms | 20,0 / 38,2 ms |
| Plattformsroll | 7 826 | 5,7 / 17,8 ms | 12,6 / 27,8 ms |

Samtidigt sparades alla 360 000 observationer per körning vid 600/s, med 1,6 ms p95 till beständig status för tolv företag och 3,0 ms för ett företag. Båda körningarna matchade 12 000 aktuella värden och 360 003 historikrader, varav 90 003 med mätarepok. Mätningen gäller den lokala mixen av HTTP-läsningar och simulatortelemetri. Samtidig faktura-, klient- och verklig leverantörstrafik samt hela uthållighetsprovet återstår.

### Förutsättningar för ett långt lokalt prov

`--phase endurance` kör samma blandning av HTTP-läsningar och simulatorobservationer med normalraterna 100 anrop och 230 observationer per sekund. Ange fördelning och antal sekunder uttryckligen, med högst 86 400 sekunder. Denna fas mäter de lokala läsvägarna och simulatorn. Produktens hela uthållighetskrav omfattar dessutom omplanering av hela flottan, planerade avbrott, klienttrafik, ekonomiflöden och leverantörer.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --scenario distributed --phase endurance --endurance-seconds 8 \
  --fixture-token-seconds 5 --telemetry --mixed-routes --metered-observations
```

Långfasen använder histogram med fast minnesåtgång för ungefärliga p95/p99 och räknar alla observerade utfall separat. Kortfaserna behåller sina exakta percentiler. Skuggvärdena stäms av per fordon och den växande råhistoriken kontrolleras med antal och summor per konto. JSONL anger planerade och faktiskt schemalagda anrop, räknar eventuella klippta mätvärden och anger om hela schemat avslutades. Ruttgränser och avstämningar bedöms från sina respektive fält.

När testtoken förnyas behålls sessions-ID, OAuth-klient och ursprunglig inloggningstid. Identitetsstubben behåller högst två testtoken per session så att ett pågående anrop kan slutföras under förnyelsen. Medgivandet gäller hela den valda fasen med marginal. Använd `--fixture-token-seconds 5` för att prova flera förnyelser under ett kort prov. Standardvärdet är en timme. Autentiseringsflödet använder den ordinarie API-verifieraren med en lokal syntetisk identitetsrespons.

En dag vid 230 observationer/s schemalägger 19 872 000 observationer plus förkontroller. Ange `--scratch-dir` till en lokal testdisk som rymmer telemetritabell och index, WAL och tillfälligt utrymme för avstämningen. Provet kontrollerar ledigt utrymme före schemaläggning och sedan var femtonde sekund. Under 512 MiB ledigt stoppar schemaläggningen och pågående anrop får gå klart. Provet rapporterar minsta observerade lediga utrymme och telemetrirelationens storlek inklusive index. Ett avbrutet schema ger exitkod 2 efter avstämning.

Använd ett slutfört lokalt uthållighetsprov med sparad `telemetryRelationBytes` och avstämd telemetrihistorik som underlag för dygnets utrymmesberäkning.

```sh
node scripts/quality/capacity-storage.mjs \
  --sample /path/to/completed-endurance.jsonl --scratch-dir /path/to/scratch
```

Förkontrollen läser filsystemets lediga utrymme. Den räknar upp uppmätta byte per observation och reserverar 512 MiB för stoppgränsen. Exitkod 2 anger att den uppskattade telemetrirelationen och reserven behöver mer utrymme. WAL, andra relationer och temporära avstämningsfiler kräver utrymme utöver uppskattningen. Tiominutersprovet på `9ae60bb` innehöll 138 003 lagrade observationer och 46 751 744 byte för tabellen och dess index. Det motsvarar cirka 6 421 MiB för 19 872 003 observationer och 6 933 MiB inklusive reserven.

Åttasekundersprovet på laddrevision `119a50fb7f8fcded7752b5216bf62a4abede57bb` gav 800 av 800 väntade HTTP-utfall och 1 840 av 1 840 beständiga observationer. Alla 1 843 historikrader stämdes av, varav 463 med mätarepok. Provet gjorde 172 tokenförnyelser med 140 skapade syntetiska sessioner, 130 använda och lagrade sessionsposter samt 230 kvarhållna token. Telemetritabellen med index upptog 712 704 byte vid slutet av körningen. Tre enhetstester verifierade förnyelse, latensräkning och avbruten schemaläggning vid otillgänglig testdisk. Hela dygnsprovet återstår.

Tvåminutersprovet på `1bfc939` körde 12 000 fordon fördelade på tolv företag, 44 migrationer i PostgreSQL 18.6 samt `--roaming-cost-routes --metered-observations --fixture-token-seconds 15`. Samtliga 12 000 HTTP-anrop och 27 600 telemetriobservationer gav väntat utfall. Periodlistan och detaljvyn hade vardera 461 godkända ekonomianrop med rätt data från alla tolv företag. Alla 461 föraranrop nekades. Högsta läs-p95 var 9,0 ms, varav periodlistan hade 6,6 ms och detaljvyn 7,1 ms. Telemetri-p95 var 1,7 ms. Identitetsstubben förnyade 1 204 token och behöll 370 token för 210 skapade syntetiska sessioner med 200 använda sessionsposter i databasen. Tabell och index för simulerad telemetri tog 9 306 112 byte efter körningen. Siffrorna avser den lokala modellen med syntetisk identitet och cirka två minuters normal last.

#### Återkommande planjobb under blandad last

`--endurance-plan-interval-seconds` aktiverar planjobb under uthållighetsfasen. Provet turas om mellan företagen och använder en laddplats med upp till 24 av företagets fordon samt en syntetisk pris- och avresetidsprofil över 96 kvartar. Ett nytt jobb får vänta tills det föregående har behandlats. Minst tre sekunder mellan starter håller även företagets återkommande läsningar inom testidentitetens ordinarie anropsgräns. Intervall som helt hinner passera under ett tidigare jobb registreras som missade.

Provet följer autentiserad mottagning, aktiv köstatus i PostgreSQL, den ordinarie arbetaren med Pythonlösaren och resultatläsning via HTTP. När samma företag får en ny version kontrolleras att det äldre jobbets resultat har spärrats. Varje ny plan stäms av mot tillgängliga kvartar, fordonens effekt- och tidsgränser, platsens totala effektgräns och exakta energimål. Jobben är rådgivande. De genererar inga fysiska laddkommandon.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --scenario concentrated --phase endurance --endurance-seconds 7 \
  --endurance-plan-interval-seconds 3 --telemetry --mixed-routes \
  --roaming-cost-routes --metered-observations
```

JSONL redovisar mottagning, arbetstid, missade intervall, ersatta jobb och avstämd energi i `endurance.planWorkload`. De extra anropen för planjobben ligger utanför den fasta läsblandningens anropstal. Ofullständiga planintervall ger separat utfall och exitkod 2.

På `ec697bf` kördes 120 sekunder med ett planjobb var åttonde sekund, förseglad roamingekonomi, mätarobservationer och testtoken med 15 sekunders giltighet. Alla 15 planjobb slutfördes i tid. De täckte tolv företag, tre ersatta planer, 360 fordonsplaner och 2 061 000 avstämda Wh. P95 var 32,1 ms för mottagning och 146,8 ms för arbetaren. Samtliga 12 000 läsanrop gav förväntad status och nyttolast. Högsta p95 bland de lyckade läsvägarna var 84,4 ms. Alla 27 600 observationer sparades med 29,9 ms i p95, och samtliga 12 000 aktuella telemetrirader stämde mot facit. Provet använde lokal PostgreSQL 18.6, 44 migrationsfiler och syntetisk identitet. Planjobben behandlade 24 fordon åt gången. Planering av hela flottan samtidigt med produktionslik trafik under 24 timmar återstår.

På `fd55bf4` kördes 300 sekunder med alla 12 000 fordon i ett företag och ett planjobb var tionde sekund. Samtliga 30 planjobb slutfördes, varav 29 ersatte en tidigare plan. De stämdes av över 720 fordonsplaner och 4 122 000 Wh. Inget av de 30 000 läsanropen eller 69 000 telemetriobservationerna tappades eller gav oväntat utfall. Högsta läs-p95 var 135,3 ms och telemetri-p95 var 30,1 ms. Planmottagningens p95 var 50,3 ms och arbetarens p95 var 178,7 ms. Körningen omfattade 46 migrationer. Varje enskilt jobb behandlade 24 fordon med syntetisk identitet och prisprofil.

På `7734a72` kördes 600 sekunder med 12 000 fordon fördelade på tolv företag och 50 migrationer. Samtliga 60 000 läsanrop och 138 000 sparade telemetriobservationer gav förväntat utfall utan tapp. Alla 60 planjobb slutfördes, varav 48 ersatte en tidigare plan. De omfattade 1 440 fordonsplaner och 8 244 000 avstämda Wh. Fordonssummeringen gav 2 069 riktiga ekonomisvar. Alla 2 069 anrop från förare och alla 2 069 från främmande ekonomianvändare nekades. Högsta läs-p95 var 112,3 ms och telemetri-p95 var 30,7 ms. Försöket använde syntetiska identiteter, simulator och 24 fordon per planjobb. Full produktmix och dygnsprov i produktionslik miljö återstår.

Sju sekunder på laddrevision `9da6d199220c0bc68d485c165e960284110d455b` gav tre färdiga jobb, två verifierade ersättningar och 412 200 avstämda Wh för 72 fordonsplaner. Samtidigt gav läsblandningen 700 av 700 väntade utfall och simulatorn sparade 1 610 av 1 610 observationer. Detta prov verifierade kö- och resultatflödet för den lilla jobbstorleken. Full flottstorlek per återkommande jobb, provade avbrott, fysisk leverantörstrafik och dygnets blandlast återstår.

#### Frysta roamingkostnader i blandningen

`--roaming-cost-routes` kräver `--mixed-routes` och migrationsfil 054 från laddbackenden. Flaggan lägger till sex anrop per trafikcykel med oförändrad total anropsfrekvens. Ekonomirollen läser periodlistan, första detaljsidan och fordonssummeringen. Provet kontrollerar nekade anrop till detaljsidan och fordonssummeringen som förare samt till fordonssummeringen i ett annat konto som ekonomiroll. Cykeln har 29 platser. De tidigare proven med ekonomiläsning använde 26 platser. Vanlig `--mixed-routes` använder 23 platser.

Provet importerar 48 kostnadsposter per företag och kopplar två poster vardera till 24 verifierade fordon genom den ordinarie granskningen. En kredit med enbart tokenkoppling ska redovisas som oallokerad. Provet förseglar månaden och en mindre föregående period i tillfällig PostgreSQL. Efter stängningen ändras en fordonskoppling och en underlagsrevision. Kontrollerna jämför den låsta perioden, detaljens ursprungliga revision, fordonens exakta antal, Wh och ören samt den oallokerade krediten med facit från importen. Fordonssummeringen läses med två sidor om 12 fordon och kontrollerar båda sidmarkörerna. JSONL redovisar förväntade utfall, roll och antalet företag vars underlag matchade, separat per roamingväg.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --scenario distributed --phase endurance --endurance-seconds 4 \
  --telemetry --mixed-routes --roaming-cost-routes
```

Fyrasekundersprovet på laddrevision `1bfc939affb939de1476a92a7086b4d39075fe66` gav 400 av 400 väntade HTTP-utfall och 920 av 920 beständiga telemetriobservationer. Periodlistan och detaljsidan gav vardera 15 av 15 korrekta svar över alla tolv företag. Alla 15 anrop som förare nekades med `403 FORBIDDEN`. Underlaget omfattade 24 frysta perioder med sammanlagt 36 dokument och tolv efterhandsrevisioner.

Två korta prov på `40156b2` använde PostgreSQL 18.6, 49 migrationsfiler, syntetisk inloggning och `--metered-observations`. Varje prov omfattade 12 000 flottfordon. Samtliga anrop gav väntad status och nyttolast och alla telemetriobservationer sparades och stämdes av.

| Fördelning | Provtid | HTTP | Telemetri | Kostnadsposter med verifierad fordonskoppling | Fordonssummering | Nekade anrop per kontroll |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Tolv företag | 20 s | 2 000 | 4 600 | 576 | 69 korrekta, p95 152,4 ms | 69 |
| Ett företag | 10 s | 1 000 | 2 300 | 48 | 34 korrekta, p95 26,4 ms | 34 |

Båda kontrollerna för fordonssummeringen gav exakta `403 FORBIDDEN` för förare och ekonomiroll som läste ett annat konto. När flottan fördelades över tolv företag riktades den andra kontrollen mot en förseglad period i ett annat företag. P95 beskriver dessa korta körningar med delade lokala resurser.

## Lokalt telemetriprov R53

Lägg till `--telemetry` för att prova den befintliga simulatoradaptern, arbetarrollen och uppdateringen av aktuell status i båda fordonsfördelningarna. Samma loopback-server används för autentiserad uppdatering och HTTP-läsning. Använd `--telemetry --skip-reconnect` för ett kort utvecklingsprov.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /workspace/charging-subscription \
  --python /path/to/fleet-venv/bin/python \
  --seconds 5 --telemetry
```

Provet matar syntetiska avläsningar genom den befintliga adaptervalideringen och den riktiga statusuppdateringen i PostgreSQL. Det kör 230 schemalagda avläsningar/s tillsammans med listning, planjobb och återkallelse, följt av 600/s tillsammans med sidvis fordonsläsning. Återanslutningsvågen omfattar ytterligare 12 000 avläsningar under en minut ovanpå 230/s. Den avgränsade toppens längd styrs av `--seconds`. Återanslutningsvågen har en fast minut enligt [lastprofilen](capacity-profile.v1.json).

Välj `--scenario concentrated` för alla 12 000 fordon i ett företag eller `--scenario distributed` för 12 företag. Välj `--phase normal`, `--phase peak` eller `--phase reconnect` för en enskild fas. Med `--peak-seconds 600` kör toppfasen de föreskrivna tio minuterna med den paginerade fordonslistan och syntetiska telemetriobservationer. Toppfasen använder samma utrymmesgräns som uthållighetsprovet och redovisar utfallet i `peak.storage`. Kör belastningsprovet utan annan pågående lokal CPU-belastning. HTTP-server, databas och lastgenerator delar resurser i den lokala miljön.

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

Det separata omprovet med `--phase reconnect --telemetry --metered-observations` på `d43e30e` verifierade 12 000 återanslutningar och 13 800 ordinarie observationer under en minut per fordonsfördelning. Alla sparades. P95 till beständig status var 1,2 ms med ett företag och 1,5 ms med tolv. Båda körningarna stämde av 12 000 aktuella värden och 25 803 historikrader, inklusive 6 453 mätvärden med mätarepok. Fordonslistan provades före återanslutningen. Själva minutprovet mätte telemetri.

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

## Omprov av den koncentrerade fördelningen den 23 november

Ett 60-sekundersprov på laddrevision `5fa53ec` med 51 migreringar hittade ett tidsfel i lastverktyget. En timer kunde släppa en observation före dess beräknade väggklockstid och då avvisade den ordinarie adaptern mätningen som framtida. Första körningen avvisade 2 828 av 13 800 observationer, samtidigt som processen avslutades med status 0. Testverktyget begränsar nu avläsningstiden till faktisk tid vid utskick och returnerar felkod när någon observation saknar beständig lagring.

Omprovet med ett företag och 12 000 fordon gav 6 000 av 6 000 väntade HTTP-svar, alla 13 800 observationer beständigt sparade och alla sex rådgivande planjobb avstämda. Högsta p95 bland lyckade läsvägar var 49,6 ms. Telemetri-p95 var 2,4 ms. Testet kördes lokalt med syntetisk identitet, PostgreSQL 18.6, förseglad roamingekonomi och normalrater på 100 läsanrop respektive 230 observationer per sekund. Den produktionslika dygnskörningen återstår.

### Omprov av periodstängning den 23 november

Det isolerade PostgreSQL-provet på aktuell laddkandidat stängde och exporterade 124 000 syntetiska CDR för 2 000 fordon. Exporten omfattade 620 sidor. Det förseglade underlaget matchade det oberoende facit på 845 981 816 Wh och 213 490 180 öre. En sen post på 3 900 Wh och 75 öre stämdes av separat. Periodstängning med samtidig import tog 2 926 ms och exporten 1 567 ms. Omprovet med 12 000 fordon avbröts när den lokala testdisken blev full. Den disponibla databasen städades. Tidigare fullskalebevis med 744 000 poster avser tidigare revision.

Senare samma dag passerade omprovet på laddrevision `45f8597` med 12 000 fordon och 744 000 syntetiska CDR. Alla 3 720 exportsidor stämdes av mot ett oberoende facit på 5 077 304 000 Wh och 1 281 416 000 öre. Samtidig import stämdes av separat med 3 900 Wh och 75 öre. Stängningen tog 20 766 ms med samtidig import och exporten 13 242 ms i disponibel lokal PostgreSQL 17. Ordinarie klienttrafik, verklig operatörsdata och fakturaleverans ingick inte.


### Ny topplast med fordonssummering och telemetri

På laddrevision `2166d13` kördes toppraten 300 HTTP-anrop och 600 simulatorobservationer per sekund med 12 000 fordon, förseglade roamingkostnader och mätarobservationer. Testverktyget `9a44acb` startade PostgreSQL 18.6 lokalt. Den koncentrerade fördelningen kördes i 600 sekunder med en gemensam pool på tio anslutningar. Av 180 000 schemalagda HTTP-anrop gav 178 953 väntade svar. Av 360 000 observationer lagrades 357 579. Lastgeneratorns tak på 400 pågående operationer gav 1 047 uteblivna HTTP-anrop och 2 421 uteblivna observationer. De anrop som skickades gav väntade statusar och nyttolaster. Samtliga 12 000 aktuella telemetrirader matchade facit för de observationer som lagrades.

Högsta läs-p95 var 1 098,5 ms för partnerrutten. Första fordonssidan gav 747,4 ms och fordonssummeringen gav 811,6 ms mot den föreslagna gränsen på 500 ms. Telemetri-p95 var 368,5 ms för beständigt skrivna observationer. Provet avslutades med kod 2 på grund av utebliven telemetri. Utrymmesvakten löste inte ut och minsta uppmätta lediga utrymme var 3 565 MiB. Kögränsen visar var lastgeneratorn slutade skicka trafik. Provet mätte inte väntetid i databaspoolen eller orsaken till att kön växte.

Två separata minutprov använde samma revisionspar, trafikmix och totalbudget med sex anslutningar för API och fyra för telemetri.

| Fördelning | HTTP med väntat utfall | Beständiga observationer | Högsta läs-p95 | Telemetri-p95 |
| --- | ---: | ---: | ---: | ---: |
| Ett företag | 17 203 av 18 000 | 36 000 av 36 000 | 2 685 ms | 47,5 ms |
| Tolv företag | 18 000 av 18 000 | 36 000 av 36 000 | 251,4 ms | 44,1 ms |

I minutprovet med ett företag nådde 797 anrop lastgeneratorns kötak. De anrop som skickades gav väntade svar, men flera läsvägar låg över gränsen. Verktyget gav först kod 0 eftersom telemetrin och schemaläggningen slutfördes. Det returnerar nu kod 2 även när läsgränsen eller en nekandekontroll fallerar. Ett separat instrumenterat åttasekundersprov med delade pooler bekräftade kod 2 vid 531,3 ms p95 för partnerrutten. Där var API-poolens väntan 153,3 ms p95 och partnerns fordonsfråga 1,4 ms p95 inklusive databasrundtur. Telemetripoolens väntan var 90,9 ms p95. Det visar väntan före SQL i det korta provet. De längre proven saknade den instrumenteringen.

P95 i tabellen räknas från schemalagd avsändning i den lokala lastgeneratorn, inklusive lokal kö och loopback. Driftens API-ingång, nätverk, ordinarie autentisering, samtidiga ekonomijobb och fysiska leverantörer ingick inte. Flottan fördelad över tolv företag klarade den provade minuten. Båda fördelningarna behöver full topptid med samma konfiguration för en jämförbar bedömning.

Vid nästa lokala förkontroll nådde arbetsytan 8 185 MiB ledigt efter städning av äldre återskapbara byggcachefiler. Telemetritabell och stoppreserv uppskattas till sammanlagt 6 933 MiB. Det lämnar 1 252 MiB för WAL, temporära filer och andra relationer. Dygnsprovet behöver bedöma och mäta de delarna separat.

### Färre databasrundor i den koncentrerade topplasten

Laddkandidaten `a7d5047` samlar inställningen av verifierade identitetsuppgifter i ett SQL-anrop. PostgreSQL sätter även principal- och kontokontexten när den läser respektive rad genom ordinarie radbehörighet. För en redan registrerad identitet sparar det fyra SQL-anrop utan konto och sex med konto. Sessionskontroll, identitetslås och behörighetsläsning sker fortfarande vid varje relevant aktörstransaktion. Anropsbegränsningen har en egen transaktion. De inledande `SET LOCAL`-satserna låter rapportläsningar välja isoleringsnivå före första frågan. 22 prov med nativ PostgreSQL, nio prov för periodstängning och operatörsekonomi, sex prov för företagsrapporter samt 125 adapter-, HTTP- och databastester passerade på kandidaten.

De lokala topplastproven använde testverktyget `57426bc`, 12 000 fordon i samma företag, PostgreSQL 18.6, 54 migrationer och en gemensam pool på tio anslutningar. I alla körningar erbjöds 300 blandade HTTP-anrop och 600 simulatorobservationer per sekund. Trafikmixen omfattade verifierade fordonssummor från redan förseglade kostnader.

| Laddrevision | Provtid | HTTP med väntat utfall | Beständiga observationer | Högsta läs-p95 | Telemetri-p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| `6ab2e7c`, före ändringen | 60 s | 17 883 av 18 000 | 35 667 av 36 000 | 1 895,5 ms | 626,6 ms |
| `6ab2e7c`, omprov | 60 s | 16 623 av 18 000 | 32 951 av 36 000 | 3 210,1 ms | 1 016,9 ms |
| `a7d5047`, kandidat | 600 s | 179 907 av 180 000 | 359 614 av 360 000 | 62,6 ms | 6,8 ms |

På kandidaten låg alla läs-p95 under 500 ms, med 16,4 ms för första fordonslistan, 30,2 ms för partnerrutten och 33,6 ms för fordonssummeringen. Lastgeneratorn nådde sitt tak på 400 pågående operationer och skickade aldrig 93 av de schemalagda HTTP-anropen och 386 telemetriobservationerna. De anrop som skickades gav väntade statusar och nyttolaster. Inga telemetriskrivningar rapporterade fel och alla 12 000 aktuella fordonsrader stämdes av mot de faktiskt lagrade observationerna. Provet avslutades med kod 2 och dygnsprovet startades inte. Kötaket visar var anrop föll bort. Olika provtider och delade lokala resurser begränsar jämförbarheten. Orsaken till de tillfälliga kötopparna återstår att mäta.

Vid 9 minuter och 30 sekunder tog PostgreSQL:s datakatalog 512 MiB, varav 353 MiB var `pg_wal` och 158 MiB var `base`. Minsta uppmätta lediga utrymme var 7 757 MiB. Det ger en lokal punktmätning av WAL under topplast. Planeringen av dygnsprovet behöver även utrymme för WAL-variation och temporära avstämningsfiler.

```sh
node scripts/quality/capacity-http.mjs \
  --charging /path/to/charging-subscription --python /path/to/fleet-venv/bin/python \
  --scratch-dir /path/to/scratch --scenario concentrated --phase peak --peak-seconds 600 \
  --telemetry --metered-observations --mixed-routes --roaming-cost-routes
```

På den integrerade laddrevisionen `bc67c7f` kördes ett 20-sekunders omprov med samma koncentrerade topp och 12 000 fordon. Det gav 6 000 väntade läsutfall, 12 000 sparade observationer och noll tapp. Lastverktyget redovisar nu kötakstapp per schemalagd minut separat för läsningar och telemetri. Kortprovet verifierade rapportformatet och det integrerade flödet. Det ersätter inte den underkända tiominuterskörningen.
