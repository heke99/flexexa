# Första laddpiloten · R46 och R58

Datum 2026-11-22. Avser även FX-007, FX-010, FX-011 och FX-015 i [projektets masterplan](../FLEXEXA_MASTERPLAN_2026-11-01.md). Ansvarig för provkörningen är laddintegrationsspåret tillsammans med platsens pilotansvarige. Arbetsstatus för fysisk körning är **blockerat**. Driftstatus för fysisk styrväg är **okänd**.

## Kodbas och körbart underlag

| Yta | Observerat på basrevisionen | Nästa ändring |
| --- | --- | --- |
| Flexexa-webb `37aec076` | EnergyWizard har rådgivande planering med kWh, avresetid, prisunderlag och ungefärlig kostnad. | Använd samma avlästa mätserie i kundportalen och kund-API när den kan läsas ur den kanoniska laddsessionen. [Byggspecifikation](../work/2026-11-13-energy-wizard-build-spec.md) |
| Laddbackend `c26766fdfb` | Teststacken kör autentiserat HTTP, PGlite med ordinarie migrationer, en beständig plankö och Python-optimeraren. `EnergyService` och `runEnergyCommand` kräver aktiverad simulator. Skuggan använder `quality=simulated`, `energy_wh` är simulatorns fordonsräknare och dispatch reserverar effekt på kontonivå. | Återanvänd kö- och läsvägarnas verifieringsmönster och lägg fysisk styrning bakom en riktig adapter. Bind styransvar till den faktiska anläggningen och varje mätvärde från den avtalade mätpunkten till rätt session och intervall. [Simulatorproven](https://github.com/heke99/charging-subscription/blob/c26766fdfb2d1b3872d245f77301e2b5888c9aa7/test/energy-simulation.test.mjs) |
| Separat energi-API `c26766fdfb` | Servern monterar rådgivnings- och planläsning. Den monterar ingen `EnergyService` och dess routegräns släpper igenom energirådgivning samt utvalda plan-, produkt- och partneroperationer. | Anslut den första godkända laddboxen via en uttrycklig produktväg i styrbackenden. Bevara rådgivningsvägen för befintliga klienter. [Runtimegräns](https://github.com/heke99/charging-subscription/blob/c26766fdfb2d1b3872d245f77301e2b5888c9aa7/src/energy-api-runtime.mjs) |
| Partnerunderlag | Laddrepots status den 12 november angav att första partner, provutrustning och täckning återstod. Den reviderade planen anger laddboxpilot först och separata fordonsprov på BMW 330e 2023 och en elbil. | Produktägaren anger pilotbox, plats, tillåtet provkonto och teknisk kontakt. Teknikägaren bekräftar gränser, mätdata och kontrakt för återläsning och kvoter per styrväg. [Befintlig laddpartneracceptans](https://github.com/heke99/charging-subscription/blob/c26766fdfb2d1b3872d245f77301e2b5888c9aa7/docs/verification/CHARGING_PARTNER_ACCEPTANCE_2026_11_12.md) |

### Lokalt simulerat prov

Kör i laddbackendens checkout med Node 24 och pinnade npm- och Python-beroenden. Provet använder disponibla konton, en loopbackserver och syntetiska laddmätvärden. Standardläget använder lokala prisfixtures.

```sh
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r workers/fleet-planner/requirements.lock.txt
PATH="$PWD/.venv/bin:$PATH" node --test test/charging-pilot.test.mjs test/energy-simulation.test.mjs test/energy-api-runtime.test.mjs
```

Pilotregressionen följer anslutning via kund-API, beständig planering och start vid 4 kW. Den hämtar 1 000 Wh, pausar och visar noll effekt. Den tidigare planen spärras och systemet nekar en ny plan medan telemetrin är för gammal. Efter färsk mätning körs en ny plan och API:t visar 2 000 Wh även efter upprepad telemetriimport. Den befintliga simulatorsviten provar bland annat förlorad kommandorespons, tenantgränser, bortkopplad bil, återkallat mandat och samtidig omplanering över en simulerad gemensam effektgräns.

| Kört prov | Miljö och resultat |
| --- | --- |
| Node-kommandot ovan | `c26766fdfb` med pilotregressionen, Node 24.19.0, Python 3.12.14, OR-Tools 9.15.6755, PGlite. **9 av 9 godkända**. |
| `node --test test/energy-native.test.mjs` | `c26766fdfb` med uppdaterad autentiseringsfixture, separat PostgreSQL 18.6-beta.19 på loopback och disponibel `charging_test`. **1 av 1 godkänt**. Samtidiga anrop gav en simulerad effekt. Ordinarie workerstart med begränsad roll behandlade ett jobb, skrev sin heartbeat och avslutade kontrollerat. Testet lämnade noll testposter och simulatorverkningar. |
| `npm run test:energy:browser` | `c26766fdfb` med uppdaterad lokal autentiseringsfixture och portaltest. Chromium 151 på **390 och 1 440 px**. Båda körningarna visade sparade laddval, simulerad start/paus och åtskilda konton. Noll sidfel, horisontellt spill eller kvarvarande testposter. Kör med `npm ci --ignore-scripts --prefix web`, Python-miljön ovan och lokal Chromium. Rapporten skrivs till `artifacts/energy-simulation/browser-report.json`. |

### Gemensamt adapterkontrakt

Laddbackendens API och köarbetare använder `src/energy-device-adapter.mjs` för att validera telemetri och kommandokvittenser från simulerade adaptrar. Adaptern mappar leverantörens egna enheter till gemensamma fält och får en avbrottssignal vid timeout. API:t verifierar konto och resurs. Köarbetaren verifierar också kommandoidentitet, begärd effekt och aktuella kapabiliteter. Ett osäkert utfall kan avstämmas mot en senare giltig kvittens.

På lokal revision `4cfcfcf` körde `test/energy-device-adapter.test.mjs` samma autentiserade API, plankö och köarbetare med en andra, oberoende testadapter. Den använde watt och promille internt. Tre riktade prov passerade. Fel konto, ogiltig telemetri och felaktig kvittens lämnade sparad status orörd. Giltig kvittens avslutade ett osäkert kommando utan nytt utskick. Kör provet mot en ny isolerad PostgreSQL 18 med `ENERGY_ADAPTER_TEST_DATABASE_URL` eller via den lokala backendtestsviten med standardfixturen.

På samma revision passerade hela backendsviten med 378 tester, det separata nativeprovet med begränsad arbetarinloggning och Chromiumprovet på 390 och 1 440 px.

R54-provet på `6147b61` körde två företag genom konto-API, ordinarie flottkö, solver och laddarbetare i isolerad PostgreSQL 18. Ett laddkommando med förlorad kvittens lämnade kön redo för direkt avstämning. När avstämningen misslyckades sparades nästa avstämningstid 10 sekunder framåt. Det andra företaget fick sitt jobb utfört under väntan. Tre samtidiga arbetaranrop efter återhämtning sparade en kvittens genom avläsning av den första effekten. Totalt anropades `executeCommand` två gånger, en gång per företag. Ett separat riktat prov verifierade att ett obekräftat stopp får ett omförsök först efter bekräftat utebliven effekt, följt av avstämning och möjlighet till ett nytt manuellt stopp.

Officiell dokumentation för Easee Cloud, Zaptec Cloud och direkt OCPP 2.0.1 har jämförts mot samma krav för mätning, lokal reserv, kvittenskontroll och kapacitet. [Leverantörskandidater](charging-provider-candidates.md)

### Laddboxmål i kWh

Simulatorns kund-API tar emot `targetKwh` med precision ned till Wh. Målet binds till en färsk mätarställning och en identifierad mätarperiod. Vanlig ändring av mål, paus och återupptagning bevarar baslinjen. En ny baslinje kräver en uttrycklig begäran. Vid mätarbyte krävs en ny baslinje före omplanering. Köarbetaren kontrollerar återstående Wh och simulatorn tillämpar energigräns och tidsgräns för kommandot.

På revision `0172485` visade portalen 0,5 levererade kWh av ett mål på 1,25 kWh, efter planering och körning genom ordinarie API, kö och simulator. Chromium körde hela flödet på 390 och 1 440 px. I separata PostgreSQL 18-prov slutförde laddningen målet även efter paus, återupptagning och tappad kvittens. En befintlig procentprofil kunde planeras och köras efter migrering 043→044. Kör `test/energy-kwh-goal.test.mjs` med `TEST_ENERGY_KWH_DATABASE_URL` för meterfallet eller `TEST_ENERGY_KWH_UPGRADE_DATABASE_URL` för uppgraderingsfallet, i varsin isolerad loopback-databas. Ordinarie backendtest använder PGlite.

## Fysisk körning på vald styrväg

Enode är senarelagt. Pilotens kWh-flöde kan börja med en avtalad laddbox, till exempel via en direkt adapter eller en laddplattform med OCPP där utrustning och avtal medger det. Kontrollera varje kapabilitet mot den aktuella kombinationen av leverantör, plats och utrustning. [Leverantörsbeslut](../DECISIONS.md#beslut-2026-11-22--leverantörsval-för-laddpiloten)

Utgå från explicit kWh-mål och faktiskt uppmätta Wh för sessionen i laddboxspåret. Procentbaserad planering använder bilens batteriprocent. Verifiera styrning, effektmätning, energimätning och eventuell biltelemetri var för sig för den valda adaptern.

Använd en dedikerad pilotplats med exakt boxmodell och firmware, en avtalad kundrelation, en bil och en verifierad mätpunkt. Dokumentera laddarens styr- och avläsningsfunktioner, platsens effekt- och fasgränser, övrig last, gällande lokala reservplan, tidsgränser, möjlig manuell överstyrning och vem som följer mätningen. Välj en avtalad mättolerans med leverantören och fastställ antal godkända upprepningar före körningen. Koppla samma korrelations-ID genom kundbegäran, plan, kommando, leverantörens tillstånd och mätserie. Mät serverns och leverantörens tider var för sig.

| Prov | Körsteg | Godkänt utfall och bevis |
| --- | --- | --- |
| Anslutning och kWh-plan | Anslut boxen under kundens verksamma mandat. Begär ett kWh-mål och en avresetid från kundflödet. Kontrollera gällande tariff och platsens faser i planunderlaget. | Anslutning, aktuellt rapporterat tillstånd, planversion och mätpunkt går att läsa med avsedd roll. En annan kund kan inte läsa planen eller tillhörande status. Planen ryms inom tillgänglig effekt/fas och visar om målet går att nå. |
| Start, paus och återupptagning | Starta från aktuell plan via normal API-ingång och kö. Läs faktisk effekt. Pausa och läs faktisk effekt igen. Återuppta under aktuell plan och avsluta sessionen. | Kvittens, uppmätt effekt per fas och avgiven sessionsenergi kan följas. Upprepa hela sekvensen med dokumenterade tider. Den slutliga mängden kWh stämmer mot oberoende avläsning inom avtalad tolerans. Portal och kund-API visar samma mätserie, kvalitet och senaste mättid. |
| Förlorad kommunikation och manuell ändring | Prova ett godkänt kommunikationsavbrott under laddning, bortkopplad box och ändrat tillstånd via lokal manöver. Begär omplanering med gammal telemetri och återanslut sedan. | Lokal reservplan eller lokalt skydd följer plats-/fasgränser. Kundvyn visar senast verifierat tillstånd och markerar att det är gammalt eller okänt. Färsk observation återställer därefter rätt status och möjliggör planering med rätt energi kvar. |
| Okänt kommandoutfall och återtag | Fördröj eller tappa svaret efter ett skickat kommando. Låt en annan arbetare återta jobbet. Upprepa sedan med utgånget kommando, ny planversion och återkallat mandat. | Avstämning via leverantörens kommando-/sessionstatus och aktuell mätbild sker före en ny fysisk åtgärd. Vid kvarstående ovisshet hålls konflikten öppen för operatören. Ingen dubbel fysisk effekt, inget kommando från återkallat mandat eller ersatt plan och inga överskridna gränser. |
| Kvot och kapacitet R58 | För varje stödväg, samla dokumenterad tilldelad kvot och kör ett representativt prov i avtalad miljö med trafiken för tillstånd, kommandon, återanslutning och avstämning. Upprepa den fysiska sekvensen på vägen. | Redovisa uppmätta anrop per aktiv bil och anläggning, toppfrekvens, kvotrespons, kommandotid, telemetriålder och återhämtningsmarginal. Jämför mot tänkt andel av 12 000 bilar och redovisa vilken flottmix provet täcker. Leverantörens egen mätserie och villkor ska kunna spåras till testet. |

Spara datum, miljöklass, kodrevision och klientbyggen, anonymiserade resursreferenser, leverantörens versionsreferens, konfigurerade gränser, versionerat provsteg och avvikelse. Spara tidslinjen för mottagen, skickad, kvitterad och uppmätt effekt samt mätarens start-/slutvärde och korrigeringar. Lägg råa leverantörsreferenser i avsett skyddat underlag och länka dit från körprotokollet. Registrera vilka kombinationer som har bevisad läsning, styrning och mätning var för sig.

**Nästa handling** är att välja testplats och avtalad styrväg, hämta dess verkliga API-/protokollkontrakt och mätdefinition, implementera adapter och efterkörning med återläsning i laddbackenden och genomföra den fysiska sekvensen. Lokal simulering lämnar R46 och R58 öppna. Inga fysiska kommandon eller driftändringar gjordes under denna checkpoint.

Skills aktiverade för verifieringsspåret är repots `verification`, `investigation-mode` och `observability`. Datautbytes- och mobil/PWA-profilerna styr provomfattning. Databasmigrering, drift, API- och klientförändringar får sina respektive skills när den fysiska adaptern och dess läsmodell införs.

### Omprov av lokal styrkedja den 23 november

På den integrerade kandidaten med stoppkontroll `da49e16` passerade 23 lokala prov för adapterkontrakt, simulerad styrning, avbrott, köarbete och autentiserad planering. Separata PostgreSQL 17-prov med disponibla databaser verifierade samtidiga kunder, exakt en effekt, städning, anslutningsåterhämtning, sen telemetri, gammal effektinformation och kWh-mål genom paus och återupptagning. Fjorton Chromiumprov med isolerad PostgreSQL passerade för energivyn och partnerflödet på dator och mobil. Tre lokala katalogtester passerade. Produktionsprov med avtalad adapter och oberoende fysisk mätning kvarstår enligt R46 och R58.

I laddkandidat `8c43e48` begränsar köns sluttid all simulerad laddning med positiv effekt, även procentmål. Kommando och kvittens bär samma sluttid. Ett nytt anrop med samma idempotensnyckel kan därför inte förlänga perioden. Det integrerade PostgreSQL-provet läste efter 45 minuter och såg noll kW och exakt 1 000 Wh från den avtalade kvarten vid 4 kW. En felaktig sluttid i kvittensen lämnade utfallet osäkert. Korrekt återläsning avslutade det utan nytt laddkommando.

### Lokal driftsättningsrepetition

Laddrevision `45f8597` paketerades lokalt med produktionsmanifest. Dockerbild `sha256:47d921808ab33816f5bb1db448001e30bb8e63424f52ae90b1483e85a7ac0ded` passerade produktionskontrollen av icke-root, bibliotek, borttagna systempaket och verklig Pythonplanering. API och arbetare startades från samma bild mot disponibel PostgreSQL över verifierad TLS, var för sig med begränsad databasroll. API gav 200 för readiness, 401 för oinloggad kontoläsning och 404 för styrvägen. Arbetaren skrev heartbeat och kövärden. Båda stängdes ned kontrollerat. Sandbox- och produktionsmallarna passerade cfn-lint och 6 respektive 7 Guard-regler. Hela backendkörningen gav 405 godkända och ett förutsättningsstyrt hopp. Den hoppade processavbrottskontrollen passerade med disponibel PostgreSQL. Webbens 129 tester, syntaxkontroll och produktionsbygge passerade. Ingen bild publicerades och inget externt system driftsattes i denna körning.
