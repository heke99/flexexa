# Lokal körning av GitHub Actions · 22 november 2026

Jobbens verifieringssteg kördes från isolerade arbetskopior eller den lokala integrationsgrenen. Tjänster för testdata startades mot loopback. Körningarna omfattar Node, Python, Chromium, PostgreSQL, OpenTofu och Docker. [Projektstatus](../PROJECT_STATE.md)

## Flexexa

På `2bcb3ba` kördes webbjobbet med Node 24.20.0 och pnpm 12.3.4 enligt arbetsflödet. Installationen använde låst beroendefil. Strukturkontroll, `plan:check`, kodindex, konsekvensanalys, lint, typkontroll, 118 tester och Next-produktionsbygge passerade. HTTP-provet verifierade åtta statiska resurser, sex väntade 404-svar, två fasta portalomdirigeringar och fyra kontaktval. Chromium kördes vid 390 och 1 440 px.

Infrastrukturjobbet körde 291 skyddstester, `actionlint` och `tofu fmt`, låst providerinstallation och `tofu validate` med OpenTofu 1.12.6. Valideringen använde en lokal backendfri kopia. GitHub-händelser, OIDC, den fjärrbaserade infrastrukturens state, AWS-plan, apply, artefaktuppladdning och publicering kräver respektive avsedd miljö. [Infrastrukturkod](../../infra) · [CI-integrering](../CI_INTEGRATION.md)

Publika installationsmanifestet verifierades på `745d8b8`, integrerat som `5edc711`. Samma låsta Node-/pnpm-versioner körde 118 tester, lint, typkontroll och produktionsbygge. HTTP-provet läste manifest, ikonernas mått och startadress. Chromium rapporterade inga installationshinder på dator- och mobilbredd. Installation på fysisk enhet och den gemensamma autentiserade PWA-resan återstår.

## Laddabonnemang

| Arbetsflöde | Verifierat lokalt |
| --- | --- |
| `verify.yml` backend | Låst installation, 394 passerade i den ordinarie sviten på `9da6d19`, samt produktionsberoenden med 0 rapporterade sårbarheter. Nativeprovet visade en slumpberoende testförväntan när ett sökt tal även fanns i en UUID. Testet använder nu hela det syntetiska registreringsnumret för verifieringsfiltret. Omprovet gav 14 av 14. |
| `energy-partner-native.yml` | Alla elva scenarier passerade på `9da6d19` med nya isolerade PostgreSQL-kluster. De täcker partner, företagsmandat, Rewards, CDR, periodstängning, företagsekonomi, migrationsparitet, kWh-mätning, uppgradering och splittrad telemetri. kWh-uppgraderingens testfilter ändrades till det aktuella testnamnet. Varje lokal rad bekräftade att minst ett prov kördes. |
| `fleet-planner.yml` | Python-kompilering, åtta Node-prov, fem Python-prov och två 12 000-resursskalor passerade. Ett separat nativeprov gick genom autentiserat HTTP, PostgreSQL-kö, Pythonlösare och återläsning av det täta resultatet. |
| `energy-simulation.yml` | På `1bfc939` passerade runtime, solver, energisimulering, containerbaserat PostgreSQL 18.7 och Chromium på två bredder. Den faktiska processavslutningen i arbetarprovet ingick. Tre genererade mallar passerade CloudFormation-lint och Guard. Dockerbilden byggdes och provades isolerat med faktisk Pythonlösare. |
| `deployment-adapter.yml` | Lokala Lambda-, runtime- och byggmallstester passerade på `1bfc939`. |
| `verify.yml` mobil | Lint, TypeScript, Expo-export för iOS, Android och webb samt Chromium-provet av den exporterade webbappen passerade på `ec697bf`. En tidigare kontoägares fördröjda medlems- och beställningssvar fick varken återställa beställningar eller visa betalningslänkar efter nedgradering till förare. |
| `web.yml` och `full-stack.yml` | På `ec697bf` passerade produktionsbygge, syntaxkontroll, 126 portaltester, 128 mockade Chromium-prov och 48 fullstackprov genom API och PostgreSQL. Den första mockkörningen hittade en konflikt när två flikar samtidigt reserverade samma Gridex-offertrevision med olika underlag. Verifierad rättning hämtar aktuell serverrevision inom samma ursprungslås. Fullstackprovet stämde även av en nedladdad CSV:s samtliga 26 förseglade laddposter. |

Docker använde arbetsmiljöns proxy och en separat skrivbar verktygskonfiguration för Debian-paketen. Playwright använde den låsta Chromium-versionen i energijobbet och redan installerade systembibliotek. Web- och Expo-proven använde lokalt Chromium. Beroendeinstallationen använde en skrivbar temporär npm-cache. Expo-exporten kördes med lokal cache och telemetri avstängd. Den ordinarie backendkörningen hoppade över ett prov som kräver en separat PostgreSQL-tjänst. Det provet kördes med sin tjänst i energijobbet.

Den samlade backendsviten på `ec697bf` gav 394 passerade, 0 fel och 1 tjänstebundet överhoppat prov. `npm audit --omit=dev --audit-level=high` rapporterade 0 sårbarheter för backendens produktionsberoenden. GitHub-hostade runners och publicering är fortsatt egna steg.

Det lokala kapacitetsprovet på samma laddrevision körde 12 000 blandade HTTP-anrop, sparade 27 600 telemetriobservationer och slutförde alla 15 periodiska planjobb för tolv företag under 120 sekunder. Alla läsutfall, telemetrirader och planernas 2 061 000 Wh stämde mot provets oberoende beräkningar. [Kapacitetsprotokoll](../progress/capacity-verification.md)

På `b304b7e` passerade alla 13 scenarier med 18 prov i PostgreSQL-matrisen, plus 14 backendprov och det täta flottprovet i egna kluster. Auditens byteidentiska migration 033 provades från tom databas och på befintliga medlemskap. RLS tillät bara aktuella medlemskap, också efter rolländring och återkallelse. Första fullstackkörningen efter portningen fångade två tappade ekonomivägar. När metoderna återställdes passerade samtliga 48 fullstackprov.

På `56ac7c5` passerade `actionlint`, fem runtime- och produktionsmallprov, CloudFormation-lint för sandbox och produktion samt sandboxens sex Guard-regler. Produktionsmallen deklarerar API-larm vid färre än två friska ALB-mål och arbetarlarm vid noll körande uppgifter. Larmen mäter två av tre enminutsintervall och behandlar saknade datapunkter som fel. Med inställningen `OperationsAlarmTopicArn` kan den avsedda miljön använda ett befintligt SNS-ämne. Larmens driftdata och aviseringar återstår att prova i den miljön.

På `fd55bf4` passerade 401 ordinarie backendprov och ett tjänstebundet prov hoppades över. Alla 16 scenarier med 35 prov i PostgreSQL-matrisen passerade, tillsammans med 16 backendprov, ett separat flottprov och 48 fullstackprov i Chromium. Energiwebbläsarprovet passerade på 390 och 1 440 px, och tio riktade adapter- och återhämtningsprov passerade. Nytt i matrisen var återhämtning av simulatorns första observation efter rollback, samtidig uppdatering av samma mätvärde och slutavräkningens separata återförsöksfönster. Fakturautkast och skatteunderlag valideras före permanent bindning. Testerna körde betalningseffekter med lokala svar och verifierade återläsning utan duplicerade effekter. Liveavisering och Stripe Sandbox för den sammanslagna revisionen återstår.

På `e40dffa` passerade 401 ordinarie backendprov, med ett tjänstebundet prov överhoppat. Samtliga 17 PostgreSQL-scenarier (37 prov) och 48 fullstackprov passerade på den slutliga lokala kandidaten. Ytterligare 16 backendprov och ett tätt flottprov kördes med egna databaser. Omkörningen använde en temporär katalog i arbetsytan efter att körmiljöns ordinarie tempdisk blev full under den parallella första körningen. Ny intern fordonsrapport verifierade att vald granskning förblir bunden till samma CDR-revision efter försegling. Provmånaden i Docker PostgreSQL 18 stängde 744 000 syntetiska poster på 25,9 sekunder och exporterade 3 720 sidor på 36,5 sekunder. Export och den oallokerade summan matchade facit på 5 077 304 000 Wh och 1 281 416 000 öre. Hela provmånaden saknade styrkta fordonsgranskningar. Riktade nativeprov innehöll även allokerade och omprövade poster.

## Företagets fordonskostnader

På laddrevision `dbcde03` passerade bygg, 126 webbenhetstester, 401 ordinarie backendprov, fem PostgreSQL-prov för företagsläsning och 48 fullstackprov i Chromium. Ett tjänstebundet backendprov hoppades över i den ordinarie sviten. Företagsportalen läser förseglad kostnad exklusive moms och energi per verifierad fordonsreferens. PostgreSQL-provet nekade andra konton, privatkonton och förarrollen. Endast exakt förseglade granskningsreferenser får ingå i frågan. Browserprovet på dator och mobil verifierade också oförändrad CSV-export. [Kvarstående företagsacceptans](../progress/masterplan-remaining-2026-11-22.md#återstående-acceptans-per-fall)

På samma revision stängdes en syntetisk period med 120 000 kostnadsposter för 12 000 företagsfordon. Av dessa hade 108 000 verifierade kopplingar och 12 000 redovisades som oallokerade. Sex sekventiella läsningar med 100 fordon per sida genom ordinarie ekonomiroll tog 704–805 ms. Körplanen under API-rollen grupperade alla 12 000 fordon på varje sida, med 730 ms databasexekvering och drygt 4 MiB temporärt diskutrymme i sorteringen. Samtliga ören, Wh och sidmarkörer stämde och åtkomst över kontogräns nekades. Provet använde syntetiska operatörsdata och en lokal verifierare för testtoken.

Migration 054 beräknar fordonssummorna i samma transaktion som varje ny period förseglas. I parade prov med samma syntetiska datamängd tog sex sekventiella HTTP-läsningar 687–924 ms på `dbcde03` och 7–15 ms på 054-revisionen `1c44d13`, integrerad i `40156b2`. Indexfrågan läste högst 101 grupper per sida. Periodstängningen tog 3,55 respektive 3,88 sekunder och lagrade 12 000 fordonsgrupper med 054. API-svaren stämde av belopp, negativa rättelser, energi och sidmarkörer. Kontogränserna höll. Äldre förseglade perioder läses genom den tidigare beräkningen över sina låsta poster. Produktionslik blandad last med verkligt operatörsunderlag återstår.

På den sammanslagna laddrevisionen `40156b2` passerade samtliga 17 PostgreSQL-scenarier med 41 prov, 16 ytterligare backendprov mot PostgreSQL, flottprovet och 48 fullstackprov i Chromium. Den ordinarie backendsviten gav 401 godkända och ett tjänstebundet överhoppat prov.

En separat fullskalig syntetisk körning på samma revision stängde 744 000 laddposter på 14,6 sekunder och exporterade 3 720 sidor på 11,1 sekunder. Posterna saknade styrkta fordonskopplingar. Exporten och den oallokerade summan stämde med facit på 5 077 304 000 Wh och 1 281 416 000 öre. Den sena rättelsen låg kvar separat på 3 900 Wh och 75 öre.

## Produktionsstatus

De lokala resultaten kompletterar den GitHub-hostade statusen. Konto- eller budgetspärr har stoppat de observerade Actions-körningarna. De två integrationsgrenarna behöver dessutom matchas mot fungerande driftschema och återstående partner-, betalnings- och laddprov. [Krav för full acceptans](../progress/masterplan-remaining-2026-11-22.md)

## Åtkomstbegäran, simulatorväxling och prisrättelse

På laddrevision `7734a72` passerade 401 ordinarie backendprov, 17 PostgreSQL-scenarier med 41 prov, 18 separata nativeprov och 48 Chromium-fullstackprov. Ett tjänstebundet backendprov hoppades över i den ordinarie sviten. Nativeprovet kunde ta bort auditens äldre direkta simulatorbehörighet, läsa bevarad historik och registrera ny status med arbetarens behörighet. Hemmaersättningens prisrättelse gav en sparad attesterad rättelse trots sex samtidiga omförsök. Den sparade två prövade differenser på −3 000 respektive +1 500 öre från låsta mätvärden och avtal. Rättelsen förbereder en avstämning. Betalnings- och bokningsvägen återstår. [Kvar till acceptans](../progress/masterplan-remaining-2026-11-22.md)

Arbetaren i `3eada5e` läser åldern på äldsta köade planjobb och äldsta olösta laddkommando. Den loggar endast de två aggregerade åldrarna. Produktionsmallen deklarerar larm vid 60 respektive 120 sekunder i två av tre enminutsperioder. Begränsad arbetaridentitet och CloudFormation-mallen provades lokalt. Uppmätta larmgränser och aviseringskedjan återstår att verifiera i målmiljön.

## Beställningar och fordon i PWA:n, laddtelemetri och operatörsavstämning

På webbcommit `f170a7a` passerade produktionsbygge, typkontroll, lint och 120 tester. Chromium verifierade att ett sent ordersvar inte visas för nästa konto, att fordon kan läsas sida för sida och att inloggade anrop varken lagras eller skickas igen efter nätavbrott. Next mot det lokala ladd-API:t och PostgreSQL verifierade även behörigheterna för kontoägare, ekonomimedlem och förare. Lokala testidentiteter användes. [Kontovyns prov](2026-11-22-customer-account-preview.md)

Laddrevisionen med operatörsavstämning och de skärpta telemetrikontrollerna klarade 401 ordinarie backendprov, med ett överhoppat tjänstebundet prov. Samtliga 18 scenarier i den lokala Actions-motsvarigheten passerade med 43 prov i PostgreSQL 18. Ytterligare 18 backendprov, ett flottprov och ett telemetrihistorikprov passerade med egna PostgreSQL-databaser. Det nya styrprovet spärrade ett positivt effektkommando vid motstridiga uppgifter för samma version. Ett syntetiskt operatörsutdrag gav de förväntade revisionsavvikelserna, saknade posterna och differenserna i öre och Wh. Fysisk styrning, verkliga operatörsunderlag och betalning ingick inte. [Återstående acceptans](../progress/masterplan-remaining-2026-11-22.md)

Portalens omkörning på laddcommit `9e1ea4c` gav 48 av 48 godkända fullstackprov i Chromium mot API:t och PostgreSQL. Den första körningen gav 47 av 48. Avbrottsprovet för Gridex väntar nu på sina pågående fixturesvar innan webbläsarsidan stängs. Backendets telemetritest provar framtida tidsstämpel och sjunkande mätarställning som separata fall.

## Kontroll mot Flexexas Supabase-databas

I `flexexa-dev` (PostgreSQL 17.6) skapades ett syntetiskt företagskonto och ett obekräftat fordon i samma transaktion. En läsning i transaktionen bekräftade fordonskopplingen. Efter rollback bekräftade en separat SQL-sats att båda de exakta prov-ID:na saknades. Tabellen för simulerad telemetri och tabellen för förseglade roamingperioder saknades fortfarande i laddschemat. Provet verifierar skrivning, återläsning och städning på plats. Kund-Auth, RLS med riktiga kundsessioner och Stripe Sandbox återstår. [Acceptansmatris](../progress/masterplan-remaining-2026-11-22.md)

## Lokal produktionsförberedelse och migreringshistorik

Laddrepots baslinje på `main` innehåller migration 001–031. Ett lokalt PostgreSQL-prov installerade baslinjen, identifierade exakt de 19 väntande kandidatfilerna, uppgraderade databasen och bekräftade att den äldre journalen bevarades och att API:t rapporterade beredskap. Migreringsverktyget stoppar nu före ändringar om det hittar okänd eller ändrad journalhistorik eller ett befintligt laddschema utan verktygets egen journal. Samtliga spärrar provades mot isolerad PostgreSQL.

En skrivskyddad läsning av `flexexa-dev` bekräftade att laddschemat finns och att Supabase har en separat journal med 58 poster. Samtliga 13 versions- och namnpar i laddrepots värdmanifest matchade. Verktygets `charging_migrations.history` saknas. Den lokala uppgraderingen gäller därför baslinjen med verktygets journal. För värdmiljön återstår en separat uppgraderingssekvens mot Supabase-journalen, med verifiering av de tidigare auditändringarna. Ingen värdmigrering genomfördes.

Den lokala omkörningen gav 120 godkända webbtester, godkänt produktionsbygge, typkontroll och lint. Laddrepot gav 401 godkända backendprov med ett tjänstebundet prov överhoppat, 43 PostgreSQL-prov i 18 scenarier och 48 av 48 fullstackprov i Chromium. Den utökade migreringskontrollen kördes separat med slutrevisionen `9c68202`.

## Uppspelning av Supabase auditjournal

En skrivskyddad läsning hämtade det kanoniska SQL-steget `20261118192918` ur Supabase-journalen. SQL-textens SHA-256 verifieras i `scripts/rehearse-canonical-audit-upgrade.mjs`. Provet installerar laddrepots 001–031 i en tom lokal testdatabas, spelar upp det hämtade auditsteget och kör 038–055. Migration 033 ingår redan i auditsteget. Provets första uppgradering rullas tillbaka och lämnar kontot samt tidigare behörighet kvar. Därefter verifieras återapplicering, API-beredskap, bevarat testkonto och den separata borttagningen av API-rollens gamla simulatorbehörighet.

För att upprepa provet, exportera endast SQL-texten i `statements[1]` för den angivna journalversionen till en lokal fil. Kör `node scripts/rehearse-canonical-audit-upgrade.mjs /sökväg/till/sql-filen` från laddrepot med `TEST_DATABASE_URL` satt till en ny lokal testdatabas. Den hämtade migreringstexten och verkliga kunddata ingår inte i repot. Övningen använde baslinjen från Git med det exakta kanoniska auditsteget. Hela värdens övriga schema, data och betalningssandboxens separata auditsteg återstår att verifiera.

Uppspelningen passerade i PostgreSQL 18 och 17.6. Docker fick slut på diskutrymme vid start av 17.6, så det provet kördes med de inbäddade PostgreSQL-binärerna. Ett separat nativeprov verifierade att arbetarens första simulatorobservation sparas efter behörighetsbytet. En avvikande SQL-fil avvisades före databasanslutning. Ingen värdmigrering eller GitHub Actions-körning startades i arbetspasset.

Betalningssandboxens separata journalsteg `20261119183453` hämtades skrivskyddat. Samma uppspelningsskript accepterar nu den kontrollsummerade SQL-texten och använder sandboxens schema och roller för Git-baslinjen och kandidatfilerna. PostgreSQL 17.6 verifierade uppgradering, rollback, omkörning och bevarat konto. Sandboxen behöll radintents, unikhet för livefakturor och arbetarens särskilda reparationsbehörighet för fakturakontext. En skrivskyddad aggregatfråga i `flexexa-dev` gav vid provet noll radintents, noll delade testfakturor och noll oposterade fakturabindningar. Den separata lokala slutkreditsviten gav 15 av 15 godkända prov. Äkta Stripe Sandbox-köp och driftsatt kund-Auth återstår. Ingen värdmigrering genomfördes.

## Tillgänglighet för externa kund- och betalningsprov

Det tidigare sandbox-API:t svarade HTTP 200 på liveness och readiness. Flexexas publika Auth-nyckelendpoint i Supabase svarade HTTP 200. Båda tillgängliga Stripe-kopplingarna rapporterade samma Trafexa-konto med `livemode=true`. De gav därför ingen verifierad väg till ett separat Flexexa-testkonto för ett nytt köp. Ingen betalnings- eller Auth-fixture skapades i de externa tjänsterna. Lokalt passerade 50 riktade betalnings- och arbetartester. Next mot PostgreSQL verifierade konto-, ekonomi- och förarbehörigheter med testidentiteter. Chromium verifierade lösenord, MFA, e-postkod, kontobyte och utloggning med samma testgräns. [Acceptansmatris](../progress/masterplan-remaining-2026-11-22.md)

## Lokal betalningskedja med omkastade webhookar

Ett nytt HTTP- och databasprov verifierar att en felaktig signatur avvisas och att `invoice.paid` utan en ännu känd prenumerationskoppling läggs för omförsök. Den riktiga arbetarloopen går vidare till en signerad `checkout.session.completed` och skapar exakt ett betalt abonnemang. Kundens konto kan läsa abonnemanget och en annan kund nekas. Omförsök och dubblerad leverans slutför båda inboxraderna utan nya abonnemang. Provet använder den lokala databasmotorn PGlite och syntetiska svar från betalningsleverantören. Migreringsparitetsprovet passerade separat i lokal PostgreSQL 17.6.

Hela lokala backendsviten passerade med 402 godkända prov och ett överhoppat tjänstebundet prov.

## Mätunderlag över svensk tidsgräns

Det lokala roamingprovet importerade två namngivna syntetiska källor som använde samma externa referens under varsin version av klockslaget 02.30 när svensk sommartid upphörde. En post som slutade millisekunden före månadsskiftet ingick i oktober. Posten som slutade exakt vid skiftet ingick i november. Efter försegling importerades en ny revision för den ena källan. Oktoberexporten behöll de tre ursprungliga raderna med 3 200 Wh och 190 öre exklusive moms. Avstämningen mot den nya revisionen gav −150 Wh och −15 öre. PostgreSQL 17.6 godkände alla fyra proven i roamingsviten. [Produktkrav FX-007](../progress/november-product-baseline.md)

Den lokala PostgreSQL-matrisen på laddkandidaten passerade 44 prov i 18 scenarier. Ytterligare 18 backendprov och ett flottprov passerade i egna databaser.

## Attmos AB sandbox som testleverantör

Stripe-anslutningen gav skrivskyddad åtkomst till Attmos AB sandbox med `livemode=false`. Stripe listade inga priser, Checkout-sessioner eller webhook-endpoints. Flexexas betalningssandbox hade två aktiva Stripe-priskopplingar, en för förskottsköp och en för abonnemang. Båda gav `No such price` mot Attmos. Ett köp genom Flexexa kräver därför att testpriser, begränsad testnyckel och webhook-signering pekar på samma sandbox. Kontrollera den kopplingen innan en ny order skapas. Ingen live- eller sandboxkonfiguration ändrades vid kontrollen.

## Publik webb i produktion

Flexexa PR #77 sammanslogs till `536ac9c51c6cfd9569df96ee5cd33e118c5b8e54`. Vercel rapporterade produktionsbygget READY. På `www.flexexa.com` gav startsidan, laddsidan, manifestet och service workern HTTP 200. Den publicerade service workerns SHA-256 matchade PR-källan. `/app/konto` svarade HTTP 307 till den befintliga kundportalen. En skrivskyddad kontroll av laddschemat bekräftade att telemetrihistorik och roamingförsegling saknas och att auditens gamla API-skrivbehörighet kvarstår. [Produktionsbygge](https://vercel.com/div3rsa/flexexa/3zVonSNHKG4anTioXQfUxVu37TT9)

Uppspelningsskriptet kan nu exportera den verifierade SQL-transaktionen till en ny fil. Den kontrollerar de förväntade schemaobjekten och den gamla simulatorbehörigheten samt använder fem sekunders låstidsgräns. Både den kanoniska kedjan och sandboxkedjan passerade i PostgreSQL 17.6. En andra körning av respektive paket avvisades och den äldre simulatorbehörigheten behölls av båda paketen. Kanonisk återkallelse provades separat efter arbetarövergången. Inget paket kördes mot värdmiljön.

## Återställd stagingportal för produktbehörigheter

Den äldre betalningssandboxens alias svarade 404 på `/admin/produkter`. Det befintliga kandidatbygget svarade 200 men JavaScript använde produktionsgatewayen. En ny Vercel Preview från laddrevision `9e1ea4c` byggdes med grenavgränsade sandboxvärden. Före aliasbytet verifierades HTTP 200, rätt Supabase Auth-projekt, sandboxgatewayen och avsaknad av produktionsgatewayens värd i JavaScript. Den godkända sandboxadressen gav CORS 204 för läsning och skrivning. Aliaset verifierades efter bytet mot `dpl_BXeJeJEdmCYdX6hAvNB3rXGmCg6y` och adminsidan svarade HTTP 200. Endast previewkonfiguration och sandboxalias ändrades. Staging-superadmin behöver fortfarande godkänna Laddabonnemang för det disponibla testkontot.

Staging-superadmin sparade Laddabonnemang för den disponibla kunden och sandboxens databas verifierade aktiv version 1. Ett uppenbart syntetiskt fordon skapades via kund-API:t och märktes i sandboxdatabasen som testverifierat. Det befintliga abonnemanget svarade `PRODUCT_NOT_READY`. En separat, tillfälligt aktiv testartikel med Stripe-testpris skapades därför med samma belopp och villkorsversion i sandboxen. Kund-API:t tog emot ordern och arbetaren skapade en Stripe-hostad Checkout-session med `livemode=false`. Testartikeln stängdes för nya beställningar direkt efter ordern. Det ordinarie abonnemangets spärr ändrades aldrig.

Stripe rapporterade den hostade sessionen `complete`, `paid` och `livemode=false`. Det första automatiserade formulärförsöket stoppade vid Link-fältet för telefon. Chromium fyllde sedan det syntetiska kortet utan Link. Stripe hade slutfört köpet när det lästes tillbaka via API:t. En signerad `checkout.session.completed` anlände till sandboxens inbox, behandlades utan omförsök och gav en betald order med exakt ett aktivt betalt abonnemang. Den inloggade testkunden läste tillbaka den betalda ordern och det enda abonnemanget. Stripe-testabonnemanget avslutades utan ny faktura eller proratering, och det separata testpriset arkiverades. Testets betalnings- och orderhistorik finns kvar för verifiering. Ingen riktig betalning genomfördes.

Efter Stripes avslutshändelse visade sandboxdatabasen det enda abonnemanget som avslutat och betalningsspärrat. Alla testsessioner loggades ut och den tillfälliga e-postinkorgen togs bort. Kundens kontorad och övrig historik för det avslutade testköpet behölls som körbevis.

## Ladddatabasens värduppgradering

De verifierade SQL-transaktionerna för 038–055 infördes via Supabase-journalen. Betalningssandboxen registrerades som `20261122213520` och det kanoniska laddschemat som `20261122213712`. Kontrollen före produktionssteget visade rätt auditbaslinje, noll väntande inboxhändelser och justeringar samt noll blockerade laddschemalås. Katalogen bekräftade telemetrihistorik, roamingstängning och prisrättelser i båda schemana efter migrering. Båda API:erna svarade HTTP 200 på readiness. Den tidigare simulatorbehörigheten finns kvar tills arbetaren har verifierats i drift.

Produktionskandidatens körmiljö paketerades från `03783283e10f76eda4021a8aafd453b574d19711` med SHA-256 `9a5fe72b5673052fdc5a764702f535c44e2016dc523294a46a3a621d98d5f160`. Produktionsstacken körde vid kontrollen fortsatt den tidigare immutabla bilddigesten `sha256:02dd75f499535541d6ac653f6ffca88eef324b89fcdd24535d2c23c2d24ed1ae`.

AWS CodeBuild `1c718c46-52ce-460a-bea3-450c8b87cf07` byggde kandidaten. Byggändringen gällde endast CodeBuild-projektet och dess läsrätt för den nya, innehållsadresserade källfilen. ECR-digesten blev `sha256:53ab56498e8ac1fc62067f7c265bdbf6fa304aef406247e7130c8b1bdb7637d9`. Skanningen gav noll kritiska, en hög (`CVE-2026-84243`, samma som föregående release), tio medelhöga och fyra låga fynd. Aktiveringen ändrade två ECS-tjänster och två taskdefinitioner. Två API-instanser och en arbetare lästes tillbaka som friska på exakt denna digest.

CloudFormation nådde UPDATE_COMPLETE. Båda ECS-tjänsterna nådde steady state med 2 av 2 API-instanser och 1 av 1 arbetare. Produktionsgatewayen gav 200 på live och readiness, 401 på osignerad kontoläsning och 404 på anonym energiplanering. Portalens energisida svarade 200. Prov av autentiserad produktionskund och arbetarens första nya simulatorobservation återstår före behörighetsväxlingen.

## Produktionsprov efter laddtjänstens utrullning

En disponibel Supabase-identitet skapades via ordinarie registrering, bekräftade sin e-postadress och loggade in. Produktionsgatewayen skapade ett tillfälligt privatkonto med HTTP 201. Kundens kontolista innehöll exakt det egna kontot, dess tomma fordonslista svarade 200 och en främmande kontoreferens nekades med 403. Produktionsgatewayen gav 404 `ENERGY_ROUTE_UNAVAILABLE` för simulatorregistrering, i enlighet med rådgivningsruntimeens ruttlista. Testets Auth-session loggades ut, appkontot och Auth-identiteten rensades och verifierades borta. Den tillfälliga inkorgen togs bort.

I det kanoniska schemat verifierade ett separat rollbackprov att `charging_worker` kan spara första simulatorobservationen. Historiken innehöll exakt en rad och skuggvärdet var 100 Wh i transaktionen. Kontot och telemetrin verifierades borta efter rollback. Provet gick genom databasrollen. Den faktiska registreringsvägen i en driftsatt simulator och inventering av äldre skrivare återstår före indragning av auditens API-behörighet.

Den kanoniska databasen hade noll simulerade skuggvärden vid den skrivskyddade kontrollen. Auditverktyget kontrollerar nu arbetarens effektiva rätt till historikfunktionen och redovisar simulatorskuggor som saknar en exakt motsvarande historikrad. PostgreSQL 17.6 verifierade att kontrollen passerar med rättigheten och underkänner en databas där den dragits in. Kontrollen körde inga skrivningar i värdmiljön.

Energiservicen kan nu ta emot en separat anslutning för arbetarens observationer. Ett lokalt nativeprov med två PostgreSQL-inloggningar utan varandras rollmedlemskap verifierade registrering, uppdatering och exakt två historikrader. API-identiteten kunde inte skriva telemetri direkt. Det driftsatta sandbox-API:t svarar 200 på readiness och 404 för simulatorfordon. Den återstående driftverifieringen kräver en separat privat sandboxtask med de två redan avgränsade databasrollerna.

## Privat simulatorprov i AWS den 23 november

Sandboxbilden från laddrevision `4a1592b` byggdes i CodeBuild `29cf0145-589f-43c2-80fc-b8ebe3fac550`. Fargate körde bilddigest `sha256:1fcc7e967e8c01fbe617bd1c9b3acfc4554aa8d2363738638072b1fcfbdd0b0e` i en privat engångsuppgift utan publik IP eller lastbalanserare. Tre initcontainrar monterade en separat API-anslutning, arbetaranslutning och kortlivad Supabase-token. Inloggningen tillhörde en disponibel sandboxägare och provet använde en syntetisk bil. Uppgiften avslutades med kod 0. Registrering, återspelning och uppdatering gav 1 → 1 → 2 historikrader. En separat databasläsning verifierade en profil, två historikrader och noll laddkommandon.

Testsessionen loggades ut och inkorgen togs bort. Rensningen verifierade att testkontot, Auth-identiteten och telemetrin var borta. AWS-engångsstacken verifierades som DELETE_COMPLETE efter stoppad uppgift. De ordinarie sandboxtjänsterna körde vidare med samma taskdefinitioner. Det här är ett sandboxbevis för hela simulatorvägen med separata roller. De ordinarie tjänsterna och produktionsbehörigheterna ingick inte i ändringen. Den fysiska laddpiloten är senarelagd på användarens begäran.

## Indragen äldre skrivrätt i produktion

Den kanoniska katalogen hade noll simulerade profiler och skuggvärden. ECS körde energi-API och arbetare med taskdefinition 3. Rådgivningsgatewayen saknar simulatorregistrering. Commerce-API och commerce-arbetare hade båda den dokumenterade kodhashen från `132170d`. Den revisionens Lambda monterar ingen simulator.

Supabase-migrering `20261123082304` körde det separata auditbytet med en kontroll under lås att inga simulerade profiler eller skuggvärden fanns. Det kanoniska API:t saknar därefter effektiv INSERT-rätt till skuggvärden och den gamla policyn är borta. Arbetaren har kvar rätt till historikfunktionen. Ett rollbackprov efter ändringen skrev första mätningen via arbetarens roll och verifierade att konto och telemetri saknades efteråt. Produktions- och sandbox-API:erna svarade HTTP 200 på readiness. Sandboxens skrivrätt och de fysiska styrvägarna omfattades inte.

## Produktionslarm för energitjänsten

Change set `flexexa-observability-20261123` lade endast till fyra CloudWatch-larm och två loggfilter i `flexexa-energy-production`. Stacken nådde UPDATE_COMPLETE. De två kömätserierna fick första datapunkten från arbetaren och båda visade noll sekunder. Larmen konfigurerades för CloudWatch-status. Ingen SNS-mottagare var konfigurerad, och larmleverans till mottagare är därför fortfarande oprövad. Den lokala mallen passerade CloudFormation-lint och fem relaterade runtimeprov.

Efter larmens inledande utvärdering lästes alla fyra till OK. API-larmet hade tre datapunkter med två friska mål och arbetarlarmet tre med en körande uppgift. Båda kölarmen hade tagit emot faktiska nollvärden. Ingen befintlig Flexexa- eller driftmottagare hittades i SNS-regionen. En ny lokal PostgreSQL 17.6-körning verifierade också arbetarens köålderssignaler, återhämtning och fullständig städning av testdata.

## Basexport för privatkonto

Den lokala laddkandidaten har en kontoägarstyrd JSON-export för kontots basuppgifter och den bekräftade e-postadressen. API:t kräver färsk inloggning och verifierad e-post samt kontrollerar både ägarmedlemskap och personligt ägarskap. Lyckad export lämnar ett granskningsspår utan att exportfilen sparas. 140 HTTP- och databasprov, 128 webbtester och båda fullstackproven i Chromium passerade. Exporten provades från den inloggade portalen på dator och mobil. Den är avstängd som standard tills motsvarande commerce-API och portal har driftsatts tillsammans. Ytterligare uppgiftskällor och raderingsflödet omfattas fortfarande av supportprocessen.

Den 23 november driftsattes basexporten i sandbox och produktion. Båda commercepaketen byggdes från respektive driftsatt basrevision med de två exportändringarna. CloudFormation ändrade endast API-Lambdans kod. Sandboxens kundprov gav HTTP 200 för ägaren, 403 för främmande referens, 401 utan inloggning och en granskningspost. Produktion gav samma status och verifierad `no-store` samt filbilaga. Produktionsportalen `3209a22` från den tidigare portalrevisionen körs på `ladda.flexexa.com`. En disponibel, verklig Supabase-kund loggade in i Chromium och sparade rätt JSON-fil från produktionsportalen. Efteråt verifierades att båda testkontona och Auth-identiteten var borttagna. Testinkorgen togs bort. [Produktionsbygge](https://vercel.com/div3rsa/flexexa-ladda-staging/FNzeHFnM5bDD8oMGrSmUPfhiDemb)

## Begäranden om registerutdrag och radering

Laddkandidaten `5fa53ec` tar emot två typer av ärenden för verifierade ägare av privatkonton. Kunden får en ärendereferens som återanvänds vid omförsök. Ett raderingsärende lämnar kontot tillgängligt för fortsatt användning medan ärendet väntar på handläggning. Operatörens interna läsverktyg visar referens, kontoid, typ och tid. Det har varken e-postadress i resultatet eller rätt att ändra ärendet.

De lokala verifieringarna omfattade 129 webbtester, 19 PostgreSQL-prov för API:et, ett separat PostgreSQL-prov för handläggarens behörighet och sidindelning samt två inloggade Chromiumprov på dator och mobil. AWS Sandbox kör API-kod från `acdc325`. CloudFormation ändrade API-Lambdans kod och Lambda rapporterade samma SHA-256 som det lokala paketet. Readiness gav 200 och en oautentiserad begäran gav 401. Sandboxens nya tabell var tom med tvingande radnivåskydd, begränsad API-skrivning och läsrätt för arbetarrollen. Tabellen saknas fortfarande i produktionsschemat. Den inloggade sandboxportalen visar ännu inte formuläret. Kundaktivering och faktisk handläggning av fullständigt registerutdrag och radering återstår.

Ett efterföljande sandboxprov använde en disponibel Supabase-identitet med bekräftad e-post. API:t gav 201 för åtkomst och radering, samma svar vid omspelning, 409 när ny avsikt använde samma nyckel och 403 för en främmande kontoreferens. Privatkontot kunde fortfarande läsas och databasen innehöll exakt två ärenden och två tillhörande granskningsposter före städning. Global utloggning och inkorgsradering gav 204. Testkontot, Auth-identiteten, ärendena, granskningsposterna och omförsöksraderna verifierades borta.
