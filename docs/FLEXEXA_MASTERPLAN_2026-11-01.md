# Flexexa — masterplan för laddabonnemang och energistyrning

Version 2.0 • 2026-11-01 • Plan och beslut, inte leveransintyg.

## 1. Mål och bindande produktbeslut

Flexexa ska vara en sammanhängande produkt för laddabonnemang, smart laddning och energistyrning. Den publika webbplatsen har två erbjudanden: laddning för bilförare och energistyrning för företag/partner. Den inloggade upplevelsen är gemensam och anpassas efter behörighet, kundrelation och köpta tjänster.

Användaren har beslutat: ett projekt, ett Git-repo, ingen monorepostruktur och inga separata webb-/mobil-/partnerprojekt. En gemensam Next.js-applikation levererar webbplats och mobilanpassad PWA. En gemensam rot-package.json, en låsfil och vanliga interna mappar används efter omstruktureringen. Bakgrundsprocesser kan driftsättas separat från webbprocessen men kommer från samma projekt och använder samma auktoritativa domänkod.

En gemensam Supabase-databas per miljö används för affärsdata. Utveckling, staging och produktion hålls åtskilda. Ett gemensamt projekt betyder inte att testdata, kunddata, integrationer och hemligheter ska blandas mellan miljöer.

Flexexa säljer energistyrning även utan laddabonnemanget. Flexexa är inte BRP och använder extern BSP för första marknadspiloten. Gridex är ingen förutsättning för laddprodukten och dess intäkter ska inte räknas in i laddabonnemangets lönsamhet.

Detta dokument är ett uttryckligt tillägg till FLEXEXA_MASTER_BUILD_PROMPT_V1.md. Vid konflikt gäller denna plans beslut om en projektstruktur, gemensam webb/PWA och laddabonnemangets affärsmodell. V1:s övriga domän-, säkerhets-, styrnings- och marknadskrav bevaras. Framför allt ersätts V1 §76:s monorepo och motsvarande mappkrav i §2–3 samt monorepopunkten i §83. V1:s historik och kravregister raderas inte.

## 2. Verifierat utgångsläge och begränsningar

Den 2026-11-01 lästes heke99/flexexa, main vid df59d718869b152b72c15723f871c1078b0380ae. Main har apps/web, pnpm-workspace.yaml, turbo.json och en äldre webbgrund. Branch phase/0-foundation innehåller en bredare grund. Main är därför inte ett bevis på att hela Flexexa-backenden finns på huvudgrenen. Grundgrenens exakta kodläge, diff, migreringar och tidigare verifiering måste inventeras före implementation och sammanförande.

Supabase-projektet flexexa-dev, ref zhgwlvmtvwjftyjmgljw, rapporterade ACTIVE_HEALTHY i eu-north-1. Listning av public-tabeller lyckades. Bland annat finns organizations, tenants, memberships, permissions, roles, customers, sites, metering_points, assets, asset_capabilities, provider_accounts, asset_connections, rule_definitions, rule_versions, policy_sets, inbox_events, outbox_events, audit_events, idempotency_records och consents. Alla listade public-tabeller rapporterade RLS aktiverat.

Detta verifierar läsåtkomst och tabellernas existens, inte policyernas riktighet, appinloggning, skrivåtkomst, kundflöden, styrning eller produktion. Inga databasändringar har utförts för denna plan. Nya tabellnamn nedan är koncept tills kolumner, constraints, funktioner och migrationshistorik inventerats.

Engineering Startkit 3.0.0 importeras med bootstrap-verktyget utan överskrivning av befintliga instruktioner. Befintlig AGENTS.md kompletteras uttryckligen. Standardens statiska kontroll är inte ett funktions-, säkerhets- eller produktionsintyg.

## 3. Erbjudanden och omfattning

| Erbjudande | Kundnytta | Ingår i första kommersiella omfattningen |
|---|---|---|
| Flexexa laddabonnemang, arbetsnamn Charge | Fast månadspris och samlad laddhantering | Avtal, betalning, verifierad hemersättning, avtalade publika laddpartner |
| Flexexa smart energi | Laddplanering och styrning efter kundbehov | Anslutna resurser, laddmål, prisoptimering, överstyrning och driftuppföljning |
| Flexexa partnerplattform | Partner kan hantera egna kundrelationer | Åtkomststyrd portal, resurser, policyer, rapporter och integrationer |
| Flexibilitet | Verifierad kapacitet via extern BSP | Börjar i simulering, därefter separat kvalificerad pilot |

Batterier, sol, värmepumpar, lokal nätflex, fler BSP:er, fler länder och V2G ligger kvar i utvecklingsplanen. De byggs i verifierbara steg och beskrivs inte som lanserade funktioner innan de fungerar.

## 4. Webbplats och sammanhängande app

| Sökväg | Innehåll |
|---|---|
| / | Två tydliga ingångar: bilförare och företag/energi |
| /ladda | Erbjudande, beslutat pris, vad som ingår, kompatibilitet, nätverk, frågor och tecknande |
| /energi | Smart laddning, energiresurser, partnernytta och demoanmälan |
| /laddplatser | Verifierade anslutna laddplatser, filter och aktuell informationsstatus |
| /sa-fungerar-det | Hemmaladdning, publik laddning, ersättning och styrning |
| /support | Hjälp, kontakt och relevanta driftmeddelanden |
| /villkor, /integritet, /cookies | Versionshanterad information för faktisk tjänst och avtalspart |
| /app | Kundens översikt och laddning |
| /app/abonnemang | Avtal, fakturor, betalning, ändring och uppsägning |
| /app/laddning | Bil, laddare, laddmål, historik och ladda nu |
| /app/ersattning | Hemunderlag, beräkning, avvikelser och ersättningsstatus |
| /app/energi | Styrbara resurser och inställningar som kunden har rätt till |
| /partner | Partnerns kunder, resurser, integrationer och rapporter |
| /admin | Intern administration, support och drift |

En användare kan ha flera relationer. Organisation väljs explicit där det behövs och verifieras på servern. Ett betalt abonnemang ger funktionstillgång men aldrig automatiskt säkerhetsbehörighet till någon annans enhet.

PWA ska fungera responsivt på mobil och dator. Installation, serviceworker, uppdatering och cache testas. Offline kan visa uttryckligen utvalda osensitiva vyer och tydligt gammal status. Betalning, start/stopp och styrkommandon kräver onlinebekräftelse; de ska inte tyst köas för senare körning. App Store/Google Play-distribution är inte beslutad och är ingen automatisk följd av PWA.

Design: gemensamma komponenter, tydliga laddnings-/fel-/tomlägen, svenska först, förberedd lokalisering och WCAG 2.2 AA som tekniskt mål. Ingen intern BSP-/BRP-komplexitet i bilförarens normala flöde.

## 5. Ett projekt och planerad omstrukturering

Målstruktur, vanliga kataloger inom ett projekt:

```
flexexa/
  package.json
  pnpm-lock.yaml
  src/
    app/
    components/
    domains/
      identity/
      customers/
      subscriptions/
      charging/
      reimbursement/
      energy/
      flexibility/
      settlement/
    kernel/
    integrations/
    workers/
    contracts/
    observability/
  supabase/
    migrations/
    tests/
  tests/
  public/
  infra/
  docs/
  tools/engineering/
```

Detta inför inga workspaces eller separata interna npm-paket. Varje affärsregel har en ägare. Webb, jobb och integrationer anropar samma regelägare. Integrationer normaliserar leverantörsspecifika payloads till gemensamma modeller.

Omstruktureringens ordning:

1. Inventera main och foundation: kod, migreringar, kontrakt, CI, containrar och faktisk drift. Lås källcommit för varje införd del.
2. Registrera befintliga kommandon och skapa en jämförbar verifieringsbaslinje. Felande grundkontroller redovisas och rättas utifrån orsak.
3. För över befintliga webb- och backendmoduler utan att skapa parallella motorer. Bevara exports/API-kontrakt eller versionshantera ändringar.
4. Flytta webb till rotprojektets src/app, interna paket till vanliga mappar och uppdatera imports, tester, CI, Docker och Vercel-inställningar.
5. Ersätt Turbo/workspace-scripts med rotprojektets explicita kommandon och uppdatera låsfil med faktisk pakethanterare. Ingen påhittad låsfil.
6. Verifiera samtliga påverkade flöden. Ta bort workspace/Turbo-konfiguration först när inget längre beror på den.
7. Säkerställ att deploy kan ske från samma repo och identifierbara kodversion. Denna dokumentleverans genomför inte omstruktureringen.

Versionsval görs från faktiskt repo och kompatibilitet, inte från tidigare chattminne. Befintliga versionslås byts inte i en dokument-PR.

## 6. Driftarkitektur från samma kodbas

Webb/PWA och dess serverrendering körs enligt befintligt Vercel-upplägg. Tidskritisk och långlivad styrning körs som bakgrundsprocesser i AWS enligt Flexexas befintliga gränser. Samma projekt kan producera webb- och workerartefakter. Ingen av dessa kräver monorepo.

| Komponent | Ansvar |
|---|---|
| Next.js | Webbplats, app, autentiserade webboperationer och presentation |
| Supabase/Postgres | Affärstillstånd, kunder, avtal, mandat, resurser, policyer, ekonomiska referenser |
| AWS worker/control | Anslutningar, planering, dispatch, återförsök och övervakning oberoende av webbsession |
| RabbitMQ | Händelsetransport med definierad återleverans och felhantering |
| Valkey | Tillfälligt tillstånd, närvaro och relevant koordination; ingen ensam affärssanning |
| ClickHouse | Högfrekvent telemetri och analys |
| S3 | Råunderlag/arkiv med rättighets- och retentionsregler |

Dessa är befintlig arkitekturinriktning; denna plan verifierar inte att tjänsterna körs. Varje tjänst införs/återanvänds efter faktisk funktion. En webbrequest ska inte behöva vänta på lång optimering eller slutförd fysisk laddning.

## 7. Datamodell och entydigt ägarskap

Gemensam databas betyder inte delad åtkomst mellan partner. Befintlig public-modell återanvänds. Tidigare schemanamn core/commerce/energy var en ansvarskarta och utgör inget krav att flytta redan fungerande tabeller till nya scheman.

| Domän | Återanvänd/utöka | Tillägg som först ska gap-analyseras |
|---|---|---|
| Identitet och tenant | organizations, tenants, memberships, roller och permissions | Kundkontokoppling, inbjudningar och tjänstetillgång |
| Kunder och resurser | customers, sites, assets, metering_points | Fordons-/laddarattribut och giltig ägarrelation |
| Anslutning | provider_accounts, asset_connections | Laddoperatörskonton och externa sessionsidentifierare |
| Regelmotor | rule_definitions/versions, policy_sets/versions | Versionerade abonnemangs-, pris- och ersättningsregler |
| Avtal och betalning | Inventera innan tillägg | Produkter/prisversioner, abonnemang, order, betalningsreferenser, faktura-/kreditreferenser |
| Laddning | assets och händelsemodeller | Laddpreferenser, planer, kommandon, normaliserade sessioner och korrigeringar |
| Hemersättning | Gemensam mät-/prismodell | Periodunderlag, energiallokeringsrader, beräkningsversioner, rättelser och utbetalningsreferenser |
| Flex och avräkning | Bevara V1:s kanoniska begrepp | Reservationer, åtaganden, aktiveringar, mätverifiering och balanserad huvudbok |
| Spårbarhet | consents, inbox/outbox, audit, idempotency | Exakt omfattning, återkallelse, avstämningsjobb och försök |

Tenantens egna laddabonnemangskunder läggs i dess kundrelationer. Samma inloggade person kan ha flera uttryckliga kundrelationer; personens identitet innebär inte global delning av kunddata. Samma fysiska resurs ska inte få två oberoende aktiva styrägare. Resurskoppling över relationer måste vara uttrycklig och tidsbunden; ingen automatisk sammanslagning på e-post eller externt fordons-ID.

Pengar använder valuta och exakta decimaler/minsta valutaenhet. Energi är kWh, effekt kW. Tidpunkter lagras UTC och lokala scheman använder Europe/Stockholm. Intervall är halvöppna. Historiska beräkningar binds till då gällande pris, avtal, mätkälla och regelversion. Korrigering skapar en spårbar rättelse; utfärdade underlag skrivs inte om tyst.

## 8. Abonnemangets affärsregler och ekonomi

Arbetsscenario: 1 600 kr/månad för obegränsad laddning inom avtalat nätverk och definierad omfattning. Slutlig momsvisning, bindningstid, uppsägning, antal bilar, delning, yrkestrafik, utland och startdatum måste fastställas före kommersiell publicering. Planen inför inget dolt kWh-tak. Eventuella användningsvillkor ska vara uttryckliga, beslutade och synliga före köp.

2,80 kr/kWh inklusive moms är användarens tidigare uppgift i kostnadsmodellen. Den behandlas som kalkylantagande för publik partnerkostnad tills partneravtal verifierat exakt innebörd, avgifter och giltighet. Den är varken verifierat inköpspris för alla operatörer eller automatisk hemersättningssats.

Hemregel: ersätt endast kvalificerad laddenergi och beslutade elhandelskostnader. Nätägarens nätavgift, effektavgift och andra nätkostnader ersätts inte. Om optimeringen tar hänsyn till nätavgifter för kundens nytta ska dessa ändå inte bokas som vår ersättningskostnad.

Månadsberäkning, innan skatt-/momsbehandling fastställts för respektive part:

- Hemunderlag = summan av godkänd hemmaladdning i kWh × tillämpligt elhandelspris enligt avtalsversion.
- Publik partnerkostnad = verifierade partnersessioner × avtalad prisregel + endast avtalade tillägg.
- Täckningsbidrag = abonnemangsintäkt på jämförbar momsgrund − hemersättning − publik kostnad − betalnings-/integrationskostnad − övrig rörlig kostnad.

Skilj kassaflöde från resultat. Eventuella flexintäkter och Gridex-intäkter redovisas separat. Visa förbrukningsfördelning och svansrisk, inte bara medelkund. Följ kundkohorter, hem/publik-andel, avtalspris, supportkostnad, förlustfall, partnerfakturor och likviditetsbehov. Sätt interna kostnadslarm utan att införa obeställda kundbegränsningar.

## 9. Komplett abonnemangsflöde

Besökare väljer produkt → ser faktisk täckning och villkor → skapar/verifierar konto → registrerar berörd bil/hemplats → accepterar identifierad avtalsversion → genomför betalning → betalningsutfall verifieras → rätt tjänst aktiveras → kund kan ansluta enhet och laddbehörighet.

Köp, betalning, abonnemang och partnerbehörighet har separata livscykler. En framgångssida är inget betalningsbevis. En bekräftad betalning med misslyckad partneraktivering ger ett synligt åtgärdsfall och definierad rättelse. Förnyelse, misslyckad debitering, återbetalning, tvist och uppsägning hanteras utan att ändra historiken.

Uppsägning anger exakt slutdatum, fortsatt tjänst under återstående giltighet och separat avslut av betalning, laddbehörighet och styrmandat. Betalningsfel ska inte automatiskt stoppa all fysisk laddning eller ta bort kundens manuella tillgång; varje tjänsts konsekvens beslutas uttryckligen.

## 10. Hemmaladdning och ersättningskedja

Anslut kundens laddare/bil via verifierad adapter. Separera vem som rapporterar mätning, vem som får styra och vilken resurs energin faktiskt tillhör. Bilens laddnivåändring ensam är inte avräkningsgodkänd elmätning.

Definiera prioriterad mätkälla och kvalitet: laddarens sessions-/mätarvärden, dokumenterad bilkälla som komplettering och ett manuellt granskat undantagsflöde. Förlorad data, mätarreset, orimlig energi, sommartid, överlappning och korrigerade leverantörsvärden har regler. Laddförlust läggs inte både på mätt laddarenergi och som extra schablon.

Månadspris från elhandelsfaktura och intervallpris är olika modeller. Den av användaren angivna månadsmodellen är utgångspunkt; vid dynamiskt avtal måste produktbeslut ange hur ett representativt elhandelspris tas fram. Använd inte hela hushållets förbrukning som laddenergi. Lagra vilka prisdelar som ingår: energi, eventuellt avtalat påslag och moms; nätkostnader är uttryckligen uteslutna.

Session → kvalificering → energiallokering → period-/prisversion → beräkning → granskningsbart underlag → godkännande enligt rättighet → betalnings-/kvittningsinstruktion enligt vald modell → extern bekräftelse → avstämning.

En energipost får endast en aktiv ekonomisk allokering för samma ersättningsändamål. Dubbelimport från bil och laddare ska inte dubbla ersättningen. Fakturauppladdning är privat, format-/storlekskontrollerad och spårbar; automatiskt extraherade belopp ska valideras och avvikelsehanteras.

## 11. Publik laddning och partneravräkning

Partneravtal och teknisk kartläggning börjar i första fasen. Första integrationen väljs efter nätverkstäckning, kostnad, kvalitet och tillgänglig testmiljö. OCPI kan användas där partnern stöder det; protokoll är inte i sig ett kommersiellt avtal. OCPP för direkt laddarstyrning och roaming/eMSP-flödet är olika gränser.

Krav per partner: platser/EVSE/kontakter, tariffer och giltighet, laddtoken/RFID eller appstart, sessionsstatus, slutligt laddunderlag/CDR, korrigeringar, fakturaavstämning och supportansvar. Visa tidsstämpel på tillgänglighetsdata. Lova aldrig att alla stationer kan användas bara för att de syns på en karta.

Startbegäran har beständig identitet. Vid timeout efter möjligt partnerutfall ska befintlig session sökas/avstämmas före ny start. Stopp, avbruten laddning, utebliven CDR, blockerings-/parkeringsavgift och efterdebiterad korrigering har explicit kund- och partnerregel. Ingen okänd avgift förs automatiskt vidare till kunden.

Första kommersiella kontrollen följer en riktig avsedd testsession från laddbehörighet till slutligt avräkningsunderlag. Marknadsföringens täckningslöfte följer verifierade avtal och integrationer.

## 12. Gemensam styrning och optimering

En styrmotor beslutar; webb, partner och BSP skickar avsikter genom samma auktoriserade kommandoväg. Kontrollera resurs, giltigt mandat, aktuell anslutning, mätkvalitet och säkerhetsgränser vid dispatch, inte bara när planen skapades.

Prioritet: fysisk säkerhet och lokala begränsningar → aktuellt mandat → kundens manuella val och mobilitetskrav → övriga accepterade åtaganden inom dessa gränser → ekonomisk optimering. Kundöverstyrning under ett marknadsåtagande ska följas av omräkning, eventuell ersättningskapacitet och avvikelsehantering; den får inte döljas.

Indata: laddnivå, batterikapacitet där känd, anslutning, effektgräns, önskad nivå, avresetid, priser, laddförlustmodell och relevanta hushållslaster. Okända värden märks och ger konservativ plan eller kundfråga. En omöjlig deadline ska visas med orsak och bästa möjliga plan; ingen ovillkorlig laddgaranti vid frånkopplad bil eller otillräcklig effekt.

Plan → versionerat kommando → kö → adapter → kvittens → observerad enhetseffekt. Mottagen API-kvittens är inte bevis på fysisk laddning. Kommandon har utgångstid, ordning/versionsskydd och skydd mot gammal worker. Mobilitetssäker fallback används där enheten faktiskt stöder lokal plan; vi får inte lova offlinefunktion på enheter som saknar den.

Prisstyrning börjar med en verifierad integrationskedja. OCPP/CitrineOS, Enode och direkta OEM-adaptrar förblir utbytbara gränser. Leverantörens kompatibilitet, villkor och kostnad verifieras innan aktivering.

## 13. Flexibilitet, batterier och fortsatt energiplattform

Först simulering/skuggläge: tillgänglighet, prognos, kvalificering, reservation, dispatch och avräkning utan verkliga marknadsbud. Därefter extern BSP-pilot med avtal, rätt resursurval, produktkrav, leveransmätning och verifiering.

En fysisk kapacitet får inte dubbelbokas mellan pooler, partner eller produkter. Reservation sker atomiskt och giltighet/kapacitet kontrolleras under samtidighet. Modellera rätt elområde, nätområde, BSP, BRP, elhandlare och tidsberoende relationer. Baseline, beräkningsmetod och mätkälla versioneras.

Verifierad marknadsersättning, besparing, hemersättning och abonnemangsintäkt är separata ekonomiska begrepp. Marknadsavräkning använder balanserade bokningar och spårbar fördelning; rättelse ska inte dubbelbokföra.

Fortsatt ordning: fler enhetsadaptrar → fler BSP:er → lokal nätflex → batteri/sol/HEMS → Edge/OEM → licensierade prisdatakällor → nya länder → direkt BSP-beredskap → V2H/V2G. V1:s långsiktiga krav bevaras, men varje steg kräver egen tillämplighets- och driftverifiering.

## 14. Behörighet, integritet och juridiska produktflöden

Kund, tenantadmin, support, drift, ekonomi och plattformsadmin är olika ansvar. Stabila permissions och objekt-/tenantkontroller gäller i server, databas, filer, export, cache, realtidskanaler och jobb. En ekonomianvändare får inte styra enheter som bieffekt av ekonomisk åtkomst.

RLS aktiveras och semantiken testas för exponerade tabeller. Same-tenant-relationer skyddas med constraints. Privilegierade tjänster får begränsat uttryckligt mandat. Integrationsnycklar/hemligheter ligger utanför klient och i avsedd hemlighetshantering.

Skilj avtalsaccept, styrmandat, rättslig grund för personuppgifter och cookieval. Registrera exakt ändamål/omfattning, informationsversion, giltighet och återkallelse. Historiskt mandat är inte tillräckligt för ett nytt kommando. En ny fordons-/anläggningsägare ska inte ärva föregående kunds historik.

Fastställ faktisk säljare, betalningsmottagare, supportansvar och personuppgiftsroller. Juridiska namn eller avtalsvillkor uppfinns inte. Konsumentvillkor, ångerrätt, uppsägning, marknadsföring, moms och fakturering ska granskas mot aktuella primärkällor före färdig checkout/publicering. Detta dokument är inget juridiskt utlåtande.

Inventera faktisk spårning före cookieimplementation. Icke nödvändiga skript får inte köras innan tillämpligt val. Export/radering, retention, privat dokumentlagring och återställning ska fungera tekniskt. Bokförings-/marknadsunderlag hanteras efter fastställd bevaranderegel.

## 15. Administration, notifieringar och drift

Admin behöver kundkort, avtal, betalningsstatus, enheter, mandat, laddsessioner, hemunderlag, partneravräkning, driftavvikelser och audit. Misslyckade jobb ska ha orsak, försök, nästa åtgärd och säker ombearbetning. Ingen obegränsad statusändring som kringgår domänregler.

Notifieringar omfattar verifiering, återställning, avtal, betalningsfel, laddfel/deadlinerisk, ersättningsunderlag och avslut där respektive händelse finns. Mottagare och juridisk avsändare hämtas från verifierad kontext. Marknadsföringsval skiljs från säkerhets-/transaktionsmeddelanden. Mallar och relevanta historiska utskick versionshanteras.

Driftmätning: anslutningsgrad, telemetrifördröjning, kommandoresultat, laddmåluppfyllelse, uteblivet underlag, betalningsfel, oavstämda belopp, dubbelförsök och kostnad per integration. Incidenter får ansvarig och dokumenterad återhämtningsväg. Loggar får inte innehålla nycklar eller onödiga personuppgifter.

Backup omfattar databas, relevanta objekt, konfiguration och återställningsberoenden. Mät och besluta RPO/RTO före pilot; anta inte att databasbackup återställer lagrade filer. Testa återläsning, återtillämpa återkallelser/raderingsbeslut och stäm av redan genomförda externa betalningar/kommandon.

## 16. Leveransfaser och acceptans

| Fas | Leverans | Acceptans för fasen |
|---|---|---|
| A | Nulägesinventering, startkit, kravregister, partnerkartläggning | Källcommits, schema-/migrationskarta, ansvar och öppna affärsfrågor dokumenterade |
| B | Ett projekt utan monorepo | Webb och relevanta workers byggs från rotprojektet; kontrakt och tester bevarade; CI/deploy uppdaterade |
| C | Publik webb, konto och gemensam PWA | Två erbjudanden; konto/återställning; rätt arbetsyta; responsivitet och tenantnegativa fall verifierade |
| D | Abonnemang och betalning | Köp, dubbla webhookar, förnyelsefel, uppsägning och avstämning fungerar i avsedd miljö |
| E | Första riktiga hemmaladdningskedja | En fysisk resurs ansluts, planeras, styrs, överstyrs och hanterar bortfall |
| F | Hemersättning | Månad kan reproduceras från godkänd energi/pris; dubbelimport och korrigering ger rätt utfall |
| G | Första publika laddpartner | Behörighet/start/stopp/session/CDR och partneravstämning verifierade |
| H | Partnerdrift och kommersiell pilot | Isolerade partnerflöden, verklig support/återställning och kostnadsuppföljning |
| I | Flex i skuggläge | Kapacitetsreservation, dispatchsimulering, M&V och balanserad simulerad avräkning |
| J | Extern BSP-pilot | Avtalad produkt, kvalificerade resurser, leveransspårning och verklig avräkning |
| K | Utökad energi och marknader | Varje ny resurs/marknad genomgår egen kontrakts-, säkerhets- och driftverifiering |

A–C kan förberedas medan partneravtal bearbetas. G är beroende av partneråtkomst, inte bara programmering. Lansering av ett abonnemang som inkluderar publik laddning kräver G. Hela långsiktiga Flexexa behöver inte vara färdigt för en korrekt avgränsad laddpilot, men oimplementerade funktioner får inte marknadsföras som tillgängliga.

Ingen pålitlig kalenderbudget anges innan A har kartlagt återanvändbar kod, integrationer, bemanning och kommersiella beroenden. Efter A uppskattas varje fas separat med externa väntetider och tydligt underlag.

## 17. Kravspårbarhet och verifieringsmatris

Följande krav-ID:n är auktoritativa för denna utökning. Status är planerat om inget uttryckligen verifierats här; implementeringsfiler och evidens fylls på i samma register, inte i en konkurrerande kopia.

| ID | Regelägare/område | Nödvändig evidens |
|---|---|---|
| FX-001 | Projektstruktur | En rotinstallation/låsfil, inga workspaces/Turbo, godkänd bygg-/CI-paritet |
| FX-002 | Webb/PWA | Två erbjudanden i en app; mobil, tangentbord, uppdatering, cache och utloggning |
| FX-003 | Identitet/RBAC | Tillåtna och nekade kund-/partner-/adminvägar med riktiga approller |
| FX-004 | Tenantintegritet | Korsade FK/objekt, filer, export, cache, historik och jobb nekas |
| FX-005 | Commerce | Betalningsreplay, fel ordning, timeout och två köpförsök skapar inga dubbla effekter |
| FX-006 | Abonnemang | Förnyelse, uppsägning, exakt giltighetsgräns och rätt prisversion |
| FX-007 | Mätning | Dubbel källa, reset, lucka, sommartid och senare korrigering |
| FX-008 | Hemersättning | Endast godkänd laddenergi/elhandelspris, inga nätkostnader eller dubbelallokering |
| FX-009 | Laddpartner | Start med timeout, dubblett-CDR, korrigering och fakturaavstämning |
| FX-010 | Styrmandat | Återkallelse/utgång kontrolleras vid dispatch; ny ägare saknar gammal historik |
| FX-011 | Styrmotor | Ladda nu, orimlig deadline, gammalt kommando, två workers och leverantörsbortfall |
| FX-012 | Flexkapacitet | Samtidiga reservationer kan inte överboka fysisk kapacitet |
| FX-013 | Avräkning | Debet=kredit, versionerat underlag och idempotent rättelse/import |
| FX-014 | Integritet/juridik | Faktiska avtalsparter, dokumentversion, cookieverkställighet, export/radering |
| FX-015 | Drift | Larm, omkörning, återställningsövning och avstämning efter avbrott |
| FX-016 | Ekonomi | Verklig separat laddkostnad, partnerkostnad och kohort-/svansriskrapport |

Varje implementerad rad kompletteras med exakt regelägare/filsökväg, tester, testad commit, miljö och utfall. Migrationsreplay och RLS testas med riktiga approller; ägaranslutning eller mock räcker inte. En UI-prototyp bevisar inte externa effekter.

För denna dokumentleverans körs standardens dokumentkontroll, befintligt planregister och diffkontroll. Appbuild/databasmigrationer/fysisk laddning påstås inte testade. För senare kodändringar används faktiskt befintliga scripts och relevant riskurval; nya kommandon registreras först när de finns.

## 18. Engineering Startkit i det löpande arbetet

Antagen version: 3.0.0. Relevanta profiler: Next.js/Supabase, white-label/organisationsisolering, abonnemang/betalning, mobil/PWA och import/datautbyte. AI-profil är senarelagd tills en konkret AI-funktion väljs; ingen modell ska äga säkerhets-, styr- eller betalningsbeslut utan deterministisk verkställighet.

Dokumentkarta: PROJECT_CONTEXT beskriver stabila fakta; PROJECT_STATE är kort checkpoint; DECISIONS innehåller beslut; detta dokument äger produktutökningens krav-ID:n och fasordning. V1 och dess befintliga coverage-register bevarar övrig långsiktig kravhistorik. CI_INTEGRATION beskriver arbetssättet; verkliga kommandon och observerade utfall registreras i kontext/status.

Arbetsordning per leverans: kontrollera faktisk kod och schema → uppdatera berört krav/regelägare → implementera hela användarresan → verifiera rättighet, domänregel, databas och extern gräns → dokumentera evidens → uppdatera status. Skilj planerat, implementerat, verifierat och driftsatt.

## 19. Öppna beslut och nästa konkreta arbete

Öppet före checkout: juridisk säljare, slutlig momsvisning, betalningsleverantör, bindning/uppsägning, bilantal/delning och behandling av yrkestrafik. Öppet före hemersättning: exakta elhandelskomponenter, månadsprismodell, mätkrav, förlustregel och utbetalning kontra kvittning. Öppet före publik lansering: partneravtal, verklig täckning, avgifter, support och priset 2,80:s avtalade innebörd. Öppet före BSP-pilot: partner, kvalificering och produktkrav.

Dessa frågor stoppar endast beroende aktivering/publicering; inventering, projektomstrukturering och oberoende produktarbete fortsätter.

Nästa implementation: inventera hela foundation-grenen mot dev-databasens fullständiga schema/migreringar och main; registrera återanvändnings- och verifieringskarta; genomför därefter fas B utan att kasta befintliga modeller eller tester. Inga nya dubbla kund-, behörighets- eller Ediel-motorer ska införas.
