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
