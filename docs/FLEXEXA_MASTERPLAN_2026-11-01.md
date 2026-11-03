# Flexexa — masterplan för laddabonnemang och energistyrning

Version 2.1 • 2026-11-03 • Plan och beslut, inte leveransintyg.

## 1. Mål och bindande produktbeslut

Flexexa ska vara en sammanhängande produkt för laddabonnemang, smart laddning och energistyrning. Den publika webbplatsen har två erbjudanden: laddning för bilförare och energistyrning för företag/partner. Den inloggade upplevelsen är gemensam och anpassas efter behörighet, kundrelation och köpta tjänster.

Användaren har beslutat: ett projekt, ett Git-repo, ingen monorepostruktur och inga separata webb-/mobil-/partnerprojekt. En gemensam Next.js-applikation levererar webbplats och mobilanpassad PWA. En gemensam rot-package.json, en låsfil och vanliga interna mappar används efter omstruktureringen. Bakgrundsprocesser kan driftsättas separat från webbprocessen men kommer från samma projekt och använder samma auktoritativa domänkod.

En gemensam Supabase-databas per miljö används för affärsdata. Utveckling, staging och produktion hålls åtskilda. Ett gemensamt projekt betyder inte att testdata, kunddata, integrationer och hemligheter ska blandas mellan miljöer.

Flexexa säljer energistyrning även utan laddabonnemanget. Flexexa är inte BRP och använder extern BSP för första marknadspiloten. Gridex är ingen förutsättning för laddprodukten och dess intäkter ska inte räknas in i laddabonnemangets lönsamhet.

Detta dokument är ett uttryckligt tillägg till FLEXEXA_MASTER_BUILD_PROMPT_V1.md. Vid konflikt gäller denna plans beslut om en projektstruktur, gemensam webb/PWA och laddabonnemangets affärsmodell. V1:s övriga domän-, säkerhets-, styrnings- och marknadskrav bevaras. Framför allt ersätts V1 §76:s monorepo och motsvarande mappkrav i §2–3 samt monorepopunkten i §83. V1:s historik och kravregister raderas inte.

## 2. Verifierat utgångsläge och begränsningar

Avsnittets nuläge nedan är historik från 2026-11-01. Senare webb-/ansöknings-/adminleveranser följs i PROJECT_STATE och arbetsloggen för 2026-11-02. Tillägget 2026-11-03 planerar fordons- och API-kontroller; det intygar inte att dessa finns i drift.

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
| Fordonsrätt och kontroll | assets, asset_connections, customers, consents och abonnemangsmodellen | Verifierade fordonsidentifierare, tidsbundna fordons-/laddpunktskopplingar, sessionsbevis, auktoriseringsreservationer och granskningsärenden; inga parallella fordonsregister |

Tenantens egna laddabonnemangskunder läggs i dess kundrelationer. Samma inloggade person kan ha flera uttryckliga kundrelationer; personens identitet innebär inte global delning av kunddata. Samma fysiska resurs ska inte få två oberoende aktiva styrägare. Resurskoppling över relationer måste vara uttrycklig och tidsbunden; ingen automatisk sammanslagning på e-post eller externt fordons-ID.

Pengar använder valuta och exakta decimaler/minsta valutaenhet. Energi är kWh, effekt kW. Tidpunkter lagras UTC och lokala scheman använder Europe/Stockholm. Intervall är halvöppna. Historiska beräkningar binds till då gällande pris, avtal, mätkälla och regelversion. Korrigering skapar en spårbar rättelse; utfärdade underlag skrivs inte om tyst.

## 8. Abonnemangets affärsregler och ekonomi

Arbetsscenario: 1 600 kr/månad för obegränsad laddning inom avtalat nätverk och definierad omfattning. Slutlig momsvisning, bindningstid, uppsägning, villkoren för den fordonsbundna grundprodukten enligt §9.1, förare/delning, yrkestrafik, utland och startdatum måste fastställas före kommersiell publicering. Planen inför inget dolt kWh-tak. Eventuella användningsvillkor ska vara uttryckliga, beslutade och synliga före köp.

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

### 9.1 Fordonsbundet abonnemang och verifiering

Tillagt 2026-11-03. Status: planerat; krav FX-017–026. Skyddet ska minska att samma abonnemang finansierar andra bilar, både hemma och publikt. Det är inte implementerat genom dagens intresseanmälan eller superadmininloggning. Det går inte att lova fullständigt missbruksskydd på alla bilar och laddare.

Planerad grundprodukt: **ett aktivt, verifierat fordon per abonnemang**. Kopplingen går till kanoniskt `asset_id` med verifierad VIN-/fordonsidentitet, inte enbart till person, mejl, laddkort eller laddbox. Flera behöriga förare av samma bil behöver inte vara flera bilar; exakt förarmodell beslutas i villkoren. Flerbilspaket kräver egna uttryckliga fordonsrättigheter, inte delad fri laddbehörighet. Obegränsad kvalificerad laddning får inte ändras till ett dolt kWh-tak som följd av kontrollen.

1. Vid aktivering samlas registreringsland, normaliserat registreringsnummer och verifierbar fordonsidentitet in. Intresseanmälan behöver inte utökas med dessa uppgifter innan tecknande kräver dem.
2. Slå upp registreringsnummer och, där laglig/avtalad åtkomst medger det, kontrollera VIN, märke, modell och drivlina. Kräv tillåten nyttjanderätt: ägande, leasing, tjänstebil eller annan dokumenterad rätt. Registrerad ägare och förare är inte alltid samma person. BankID kan verifiera personen men bevisar inte ensam bilens närvaro vid laddaren.
3. Knyt den valda bilen från OEM-/fordons-API till samma verifierade resurs. Ett konto med flera bilar ska inte ge alla dessa abonnemangstillgång. Manuellt inskriven VIN, uppladdat foto eller visat registreringsnummer är påståenden tills källkontroll har gjorts. Saknad VIN-/registeråtkomst kräver en dokumenterad alternativ verifieringsväg; avvikande importfordon hanteras som undantag.
4. Registrera beviskälla, verifieringstid, omfattning, källa för nyttjanderätt, giltighet och omverifieringsbehov. API-åtkomst till bilen bevisar en viss åtkomst, inte automatiskt juridiskt ägande.
5. Ändrat registreringsnummer på samma bil ska kunna rättas utan att fysisk fordonsidentitet byts. Försäljning, byte av bil, lån-/ersättningsbil och ägarbyte använder ett tidsbundet bytesflöde med ny verifiering. Tillfällig ersättningsbil ersätter grundbilens rätt under perioden; den skapar inte två samtidiga rättigheter som standard. Slutliga undantagsvillkor och eventuella bytesintervall beslutas före köp, inte som godtycklig dold spärr.

### 9.2 Vad kontrollerna kan och inte kan bevisa

| Underlag | Kan användas för | Begränsning och konsekvens |
|---|---|---|
| Registreringsnummer + verifierad VIN | Avtalskoppling, registerkontroll och fordonsbyte | Identifierar avtalad bil, inte automatiskt bilen vid kontakten. VIN är identifierare, ingen hemlig autentiseringsnyckel. |
| App, QR-kod, RFID eller eMSP-token | Auktorisera kundens laddbegäran | Kunden kan stå bredvid en annan bil eller låna ut token. QR-/telefonposition och inloggning räcker inte som fordonsbevis. |
| ISO 15118 Plug & Charge | Starkare autentisering genom certifikat där hela kedjan stöds | Kontrakts-/certifikatidentitet måste genom kontrollerad registrering knytas till rätt fordon. Ett eMAID är inte ett VIN. Certifikatförnyelse, återkallelse och ominstallation måste hanteras. |
| Autocharge/EVCCID | Partnerns identifiering av en ansluten bil där det stöds | Kan vara MAC-baserad och är inte likvärdig med kryptografiskt fordonsbevis. Stöd, återregistrering och fel-/spoofningsrisk ska utvärderas; inte antas fungera över roaming. |
| Bilens laddstatus, tid, plats och energisignaler | Oberoende rimlighetskontroll mot laddsessionen | Varierande API-stöd, fördröjning och felmarginal. Att rätt bil samtidigt laddar i närheten utesluter inte ensamt att sessionen avser en annan bil. |
| Hemladdarens ID och energimätning | Mängden energi och avsändande laddpunkt | En godkänd box kan ladda flera bilar; box-ID/RFID ensamt kvalificerar inte all energi för ersättning. |

Kvalificering ska skilja **identifierat fordon**, **sessionens energimätning** och **rätt till ersättning**. Direkt, kontrollerat fordonsbundet partnerbevis prioriteras. Samstämmig bil-/laddardata utan direkt bindning är en svagare metod med uttryckligt godkänd kvarstående risk. Kontrollstyrka får inte härledas enbart från protokollets versionsnummer.

### 9.3 Gemensamt beslut, samtidighet och livscykel

`subscriptions` äger fordonsrätten, `charging` äger sessionsauktorisering och `reimbursement` äger ekonomisk kvalificering. Verifieringsadaptrar tillför bevis. Versionerade produkt-/riskregler ligger i befintlig Kernel/Policy & Rules Layer; deterministiska domänoperationer verkställer dem. En eventuell avvikelsemodell får ge signaler, inte ensam besluta sanktioner.

- Inför/utöka giltighetsbundna fordonskopplingar efter schema-gap-analys. Skydda högst en överlappande fordonsrätt per grundabonnemang med databasconstraint och transaktion. Skydd mot dubbelfinansiering av samma fordonsenergi gäller även flera abonnemang. Sökning över tenantgräns får endast ske genom avgränsad auditerad plattformsoperation utan att röja andra kunders uppgifter.
- En ny sponsrad session reserveras atomiskt för den giltiga fordonsrätten, oavsett hem/publik kanal och om starten sker från kund, partner, RFID eller worker. Kontrollera vid beslut och dispatch: avtal, fordonskoppling, mandat, tokenstatus, kapabilitet, färskhet och känd pågående fysisk laddning.
- Dubblettwebhook eller en session som syns i flera källor ska normaliseras till samma session, inte räknas som två bilar. Två motstridiga färska bevis om faktisk energileverans ger avvikelse. En gammal `ACTIVE`-status är inte ensam bevis på samtidig laddning.
- Starttillstånd: `reserved → dispatching → active → finished`, med separata `failed` och `outcome_unknown`. Reservation har lease/utgång och skydd mot gammal worker. Efter möjlig extern start får utgång inte ensam frigöra rätt till ännu en start: partnerstatus måste stämmas av. Partner-CDR kan komma långt efter att bilen lämnat; fysisk avslutning och ekonomiskt slutunderlag är olika tillstånd.
- Fordonsbyte/revokering och sessionstart låser samma rättighetsversion. Ett byte väntar på eller säkert avstämmer pågående laddning, stänger gammal giltighet, återkallar gamla tokens/certifikatkopplingar och aktiverar ny verifierad bil utan oavsiktlig överlappning. Gamla sessioner bedöms mot då gällande fordonskoppling.
- Byten kräver aktuell autentisering, uttrycklig rättighet, skäl och audit. Okända register-/leverantörsutfall ger väntande verifiering, inte automatiskt godkännande. Nya tjänsteaktiveringar visar detta innan betalningslöfte lämnas.

Sessionens kvalificeringsstatus är separat: `eligible`, `pending_verification`, `ineligible` eller `manual_review`, med maskinläsbar orsak, regelversion och bevisreferenser. Den får inte skriva om avtalets betalningsstatus eller beordra akut fysisk frånkoppling för en ekonomisk avvikelse.

## 10. Hemmaladdning och ersättningskedja

Anslut kundens laddare/bil via verifierad adapter. Separera vem som rapporterar mätning, vem som får styra och vilken resurs energin faktiskt tillhör. Bilens laddnivåändring ensam är inte avräkningsgodkänd elmätning.

Definiera prioriterad mätkälla och kvalitet: laddarens sessions-/mätarvärden, dokumenterad bilkälla som komplettering och ett manuellt granskat undantagsflöde. Förlorad data, mätarreset, orimlig energi, sommartid, överlappning och korrigerade leverantörsvärden har regler. Laddförlust läggs inte både på mätt laddarenergi och som extra schablon.

Månadspris från elhandelsfaktura och intervallpris är olika modeller. Den av användaren angivna månadsmodellen är utgångspunkt; vid dynamiskt avtal måste produktbeslut ange hur ett representativt elhandelspris tas fram. Använd inte hela hushållets förbrukning som laddenergi. Lagra vilka prisdelar som ingår: energi, eventuellt avtalat påslag och moms; nätkostnader är uttryckligen uteslutna.

Session → kvalificering → energiallokering → period-/prisversion → beräkning → granskningsbart underlag → godkännande enligt rättighet → betalnings-/kvittningsinstruktion enligt vald modell → extern bekräftelse → avstämning.

En energipost får endast en aktiv ekonomisk allokering för samma ersättningsändamål. Dubbelimport från bil och laddare ska inte dubbla ersättningen. Fakturauppladdning är privat, format-/storlekskontrollerad och spårbar; automatiskt extraherade belopp ska valideras och avvikelsehanteras.

### 10.1 Bara den avtalade bilens hemmaladdning ersätts

Registrera den godkända platsen, laddarens externa identitet/serienummer, EVSE/kontakt, mätkälla och giltig kundrelation. Visa kompatibilitetskontrollen innan kunden beställer en lösning eller lovas automatisk hemersättning. OCPP är inte ett generellt löfte om att en hemmaladdare kan läsa VIN; vanlig AC-laddning kan sakna identifiering av bilen.

Per session ska kedjan kunna visa **vilken bil → vilken laddpunkt/kontakt → vilket tidsintervall → hur många uppmätta kWh → vilken fordonsrätt → vilken prisregel**. Direkt verifierad fordonsidentifiering i laddkedjan prioriteras. Om sådan saknas prövas en kombination av vald bilanslutning, anslutnings-/laddstatus, laddarens sessionsintervall och energiförlopp samt plats när det är tillgängligt, nödvändigt och rättsligt bedömt. Varje signal får egen observationstid, mottagningstid, källa och kvalitetsmarkering. Fastställ färskhet och toleranser per adapter i pilot; telefon-GPS eller ett kundkryss är inte ersättning för fordonsbevis.

| Hemfall | Planerat utfall |
|---|---|
| Avtalad bil med tillräckliga bevis och giltig mätning | Kvalificera verifierad laddenergi och skapa en enda ekonomisk allokering. |
| Annan bil laddar på samma godkända box | Kvalificera inte den bilens energi för abonnemanget. Det ska fortsatt gå att ladda privat enligt kundens vanliga betalning. |
| Rätt bil byts mot annan bil mitt under perioden | Dela vid verifierbar sessions-/anslutningsgräns. Om fördelningen inte kan styrkas hålls den osäkra delen för granskning, inte hela hushållets månad. |
| Delad box, flera kontakter eller gemensam parkering | Kräver mätning och fordonskoppling per kontakt/session samt uttryckligt mandat. Identifiera inte bilen enbart via bostadsadress eller gruppens totalmätare. |
| Bil-API sover, tappar åtkomst eller rapporterar gammal position | `pending_verification`; återhämta/avstäm utan dubbelersättning. Bortfall är inte automatiskt missbruk. |
| Bara boxmätning, elräkning eller bilens SoC finns | Underlaget räcker inte ensamt till automatisk fordonsbunden ersättning. Erbjud dokumenterad manuell verifiering om den faktiskt kan styrka bil och energi; annars inte denna aktiveringsväg. |

Bilens batteriökning och laddarens nätenergi behöver inte vara lika på grund av förluster och andra laster. De används som rimlighetssignaler med dokumenterad tolerans, inte en ny schablon som dubbelräknar laddförlust eller ersätter mätning. Publicera ingen generell procentsats innan pilotunderlag finns.

Månadsunderlaget ska skilja godkänd energi, under granskning, avvisad energi och senare rättelser med begriplig orsak. Endast godkänd del går vidare enligt §10:s elhandelsmodell; nätavgifter förblir uteslutna. Att kunden använder flera egna bilar får inte göra den gemensamma boxens hela energimängd ersättningsbar.

## 11. Publik laddning och partneravräkning

Partneravtal och teknisk kartläggning börjar i första fasen. Första integrationen väljs efter nätverkstäckning, kostnad, kvalitet och tillgänglig testmiljö. OCPI kan användas där partnern stöder det; protokoll är inte i sig ett kommersiellt avtal. OCPP för direkt laddarstyrning och roaming/eMSP-flödet är olika gränser.

Krav per partner: platser/EVSE/kontakter, tariffer och giltighet, laddtoken/RFID eller appstart, sessionsstatus, slutligt laddunderlag/CDR, korrigeringar, fakturaavstämning och supportansvar. Visa tidsstämpel på tillgänglighetsdata. Lova aldrig att alla stationer kan användas bara för att de syns på en karta.

Startbegäran har beständig identitet. Vid timeout efter möjligt partnerutfall ska befintlig session sökas/avstämmas före ny start. Stopp, avbruten laddning, utebliven CDR, blockerings-/parkeringsavgift och efterdebiterad korrigering har explicit kund- och partnerregel. Ingen okänd avgift förs automatiskt vidare till kunden.

Första kommersiella kontrollen följer en riktig avsedd testsession från laddbehörighet till slutligt avräkningsunderlag. Marknadsföringens täckningslöfte följer verifierade avtal och integrationer.

### 11.1 Publikt skydd mot laddning av annan bil

Kundens laddtoken knyts till abonnemangets aktuella fordonsrätt. Vid partnerauktorisering ska det gå att kontrollera rättigheten i realtid, få en beständig auktoriseringsreferens och sedan knyta session/CDR till samma beslut. En appstart, giltig RFID eller OCPI-token ger inte ensam bevis på fysisk bil.

För varje bil/partner/laddpunktskombination väljs en dokumenterad kontrollprofil:

| Profil | Förutsättning | Planerat användningssätt |
|---|---|---|
| P1: direkt fordonsbindning | Partner-/laddkedjan tillför kontrollerad fordonskoppling, exempelvis certifikatbaserad Plug & Charge med verifierad registrering | Prioriterad väg. Kontrollera livscykel, återkallelse och att identifieringen faktiskt lämnas till oss eller partnern verkställer bilspärren med granskningsbart beslutsbevis. |
| P2: kompletterande fordonsdata | Token/session kan korsas med tillräckligt färsk data från den avtalade bilen | Pilotvaliderad alternativ väg. Dokumentera kvarvarande risk för bland annat två bilar som laddar samtidigt på samma plats. Autocharge utan tillräckligt stark bindning bedöms här. |
| P3: otillräckligt underlag | Enbart delbar token, osäker identitet eller otillgänglig nödvändig data | Ingen automatisk sponsrad start som standard. Erbjud känd alternativ ladd-/betalningsväg eller ett i förväg avtalat begränsat undantag. Ingen okänd privat kostnad eller efterhandsavgift utan kundens information/accept. |

Ladda inte upp ett allmänt återanvändbart frikort som kan kringgå dessa profiler. Undersök realtidsauktorisering, partnerns offline-cache, whitelist, spärrfördröjning, start via partnerns egen app och alla RFID-/certifikatvägar. Om partnern kan tillåta offline- eller lokalt whitelistanvändande måste denna kvarvarande risk uttryckligen lösas i kontrakt/produkt eller kombinationen undantas; en spärr i Flexexas app stoppar inte automatiskt en partners offlineauktorisering.

Online-start/nekad start och efterhandskontroll är separata funktioner. Ett sent CDR kan avslöja en avvikelse men kan inte förhindra redan levererad laddning. Partnerns faktura avstäms enligt partneravtal även när kundsessionens subvention utreds; tvistad energi får inte tyst försvinna ur kostnadsuppföljningen. Redan pågående laddning avbryts inte automatiskt för en riskpoäng. Samma mobilitets-/säkerhetsordning som i §12 gäller.

### 11.2 Avvikelser, support och integritet

Signalera samtidig verklig energileverans hemma/publikt för samma bil, motstridiga fordonsidentifierare, onormalt många bil-/tokenbyten, omöjliga tids-/platskombinationer, återkallad nyttjanderätt och upprepad avsaknad av nödvändiga bevis. Hög körsträcka eller hög kWh-förbrukning ensam är inte avtalsbrott i ett obegränsat abonnemang.

Skapa ett avgränsat granskningsärende med bevis, källfel, aktuell policyversion, ansvarig, svarstid och nästa handling. Separera teknisk datalucka från konstaterad fel bil. Kunden får begriplig orsak och möjlighet att komplettera/invända. Support kan begära underlag; ekonomi kan godkänna ersättning; behörig kontrollfunktion kan begränsa nya subventionerade starter efter beslutade villkor. Superadmin använder samma auditerade verksamhetsoperationer. Undantag kräver skäl, omfattning och slutdatum; ingen fri statusändring eller ologgad whitelist.

Återkrav, extra debitering, längre avstängning eller uppsägning på grund av missbruk kräver uttrycklig avtalsregel, tillräcklig verifiering och mänsklig prövning före verkställighet. Automatiska signaler får inte bli ett otydligt anklagelse-/sanktionssystem.

Fordonsidentifierare, nyttjanderätt, laddhistorik och platsdata ska få dokumenterat ändamål, rättslig grund, behörighet och retention före insamling. API-/styrmandat, avtalsaccept och marknadsföringssamtycke är separata. Utred behov av konsekvensbedömning för plats-/beteendekontroll. Föredra sessionsbundna matchningsresultat och nödvändiga bevis framför permanent ruttspårning; skicka inte full VIN, precisa positioner eller råa tokens till vanliga loggar/partnerexporter. Gallringsfrister och eventuell laglig bevaring fastställs per datakategori före pilot. Registerslagning, kartläggning av fordon i annan tenant och kontrollärenden får inte läcka andra kundrelationer.

### 11.3 Externa API:er och leverantörsgranskning

Inventera först V1 §§66–68, befintliga adaptrar/kontrakt och foundation-grenen. Nuvarande rotprojekt har API:er för ansökningar och superadmin; dessa är inte bevis på att nedanstående ladd-/fordons-API:er finns. Återanvänd `assets`, `asset_connections`, identitet, mandat och domänoperationer; skapa inget separat mobilrepo, fordonsregister eller Supabase-projekt för kontrollfunktionen.

| Integrationsgräns | Utred och verifiera före val | Begränsning att dokumentera |
|---|---|---|
| Fordonsregister | Transportstyrelsens godkända åtkomst eller avtalad fordonsdataleverantör: tillåtna uppslag, VIN-mappning, villkor, kostnad, datakvalitet och nyttjanderätt | Ingett antaget öppet/fritt svenskt regnummer-API; åtkomst/tillstånd och avtal måste verifieras. Registerdata visar inte pågående laddning. |
| OEM / Enode eller motsvarande | VIN/extern resurs, vald bil, laddstatus, tidsstämplar, eventuell position/energi, godkända scopes, återkallelse och per-modellstöd | Samma märke kan ha olika stöd per modell, årsmodell, region, abonnemang och firmware. Ett API-konto kan exponera flera bilar. |
| Laddboxleverantör / OCPP | Betrodd laddaranslutning, serienummer, kontakt, energi, sessionsgränser, offlinebuffring, eventuell fordonsidentifiering och mandat | Mätdata och fordonsidentitet måste verifieras separat. Laddboxen får inte godkännas bara för att OCPP finns. |
| CPO / roaming / OCPI | Avtalad protokollversion och moduler, realtidsauktorisering, identitetsbevis, start/stopp, tokens, session/CDR, spärrning och avstämning | Stöd för Autocharge/Plug & Charge i partnerns konsumentapp innebär inte att eMSP-/roamingintegrationen får samma funktion. |

Per kombination skapas ett versionsbundet kompatibilitetsregister: källa, modell/firmware, protokoll/moduler, observerade fält, verifieringsprofil P1/P2/P3, tidsfördröjning, precision, pris/rate limits, drift-/avtalsansvar och datum/evidens från test. Kapabilitet kan vara `supported`, `unsupported`, `unknown` eller `temporarily_unavailable`; saknat fält räknas inte som bevis för fel bil. Försämrad kapabilitet utlöser omprövning och kundinformation, inte tyst oförändrat täckningslöfte.

Partnerfrågor i första kontakten: Kan ni binda subventionerad laddning till verifierad bil och lämna beslutsbevis? Hur registreras/återkallas kopplingen? Fungerar kontrollen även för eMSP/roaming och offline? Vilka alternativa startvägar finns? Vilka sessions-/CDR-korrigeringar och testkonton får vi? Vem bär kostnad vid felaktig auktorisering? Begär testspecifikation, datamappning och kommersiellt ansvar innan täckning aktiveras.

### 11.4 Flexexas egna API-kontrakt

V1:s versionshanterade `/v1`-API kompletteras med följande **planerade kontrakt**; sökvägar är målbild, inte driftsatta endpoints. OpenAPI med schemas, fel, permissions och exempel skapas före API-implementation. Webb/PWA, B2B och bakgrundsjobb använder samma regelägare; Next.js är gränsyta och långlivad/tidskritisk kontroll följer AWS-gränsen i §6.

| Planerad operation | Tillåten aktör och regelägare | Viktigt kontrakt |
|---|---|---|
| `POST /v1/assets/{id}/vehicle-verifications` | Kund för egen resurs eller behörig handläggare; identitet/anslutning | Startar verifiering, returnerar ärende-ID/status; klienten får inte sätta `verified`, ägare eller bevisstyrka. |
| `GET /v1/assets/{id}/capabilities` | Behörig kund/partner; befintlig asset-domän | Visar verifierade kapabiliteter och färskhet, utan råa hemligheter. |
| `GET /v1/subscriptions/{id}/vehicle-bindings` | Kund/partner med objekträtt; subscriptions | Giltiga/historiska kopplingar inom tillåten relation. |
| `POST /v1/subscriptions/{id}/vehicle-changes` | Behörig kund/handläggare; subscriptions | Stegvis verifiering och versionsskydd; inga två aktiva fordonsrättigheter vid samtidiga byten. |
| `POST /v1/charging/authorizations` | Verifierad kundbegäran eller avgränsad partneridentitet; charging | Atomiskt beslut/reservation per fordon, sessionstyp, EVSE och avtal. En intern riskutvärdering är aldrig ensam en partnerbehörighet. |
| `POST /v1/charging/sessions` och `POST /v1/charging/sessions/{id}/stop` | Behörig kund/partner; charging | Start kräver giltig serverutfärdad auktorisering. Stopp får inte kringgå sessionens ägarskap. Mottaget kommando skiljs från fysisk effekt. |
| `GET /v1/charging/sessions/{id}/eligibility` | Behörig kund/handläggare; charging/reimbursement | Beslut, begriplig orsak och kompletteringsväg utan rå riskmodell eller andra kunders data. |
| `GET /v1/reimbursements` och `GET /v1/reimbursements/{id}` | Behörig kund/ekonomi; reimbursement | Filtrerad/paginerad period med godkänd, väntande och avvisad energi samt rättelseversion. |
| `GET /v1/review-cases` och `POST /v1/review-cases/{id}/decisions` | Särskild handläggarpermission; ansvarig domän | Läsning, beslut och undantag separata rättigheter; skäl, evidens, versionskontroll och audit krävs. |
| `POST /v1/integrations/{provider}/events` | Autentiserad leverantörsadapter | Provider/konto binds till registrerad serverkontext, inte till tenant-ID eller identitet i payload. Schemat låses per adapter. |

Alla anrop härleder actor/tenant från verifierad session eller avgränsad tjänsteidentitet och kontrollerar aktuell objekträtt, fält och historik. B2B följer V1:s OAuth2 client credentials, scoped pilotnycklar och mTLS där känslig partnerintegration kräver det. Regnummer/VIN får inte fungera som lösenord eller publik obegränsad uppslagsnyckel. Klientens valda `asset_id` måste höra till den giltiga fordonsrätten; samma regel gäller via alternativa API-/RPC-/direktdatavägar.

Mutationer har tenant-/operation-/actor-bunden `Idempotency-Key`, canonical payload-hash och beständigt utfall; samma nyckel med annat innehåll ger konflikt. Versionsskydd används för bytes-/granskningsbeslut. Svar beskriver `401/403` för nekad åtkomst utan objektläckage, `409` för konflikt, `422` för ogiltigt underlag, `429` för budgetgräns och `503` för tillfälligt otillgänglig beroendetjänst. Asynkront mottaget ärende kan ge `202`; det är inte godkänd laddning. Skilj `VEHICLE_MISMATCH`, `EVIDENCE_STALE`, `CAPABILITY_UNAVAILABLE`, `ACTIVE_SESSION_CONFLICT` och `VERIFICATION_REQUIRED` i behörigt svar med spårbar request-/beslutsreferens.

Inkommande händelser verifieras enligt leverantörens mekanism, där sådan finns med signatur och tids-/replayskydd; annars krävs en dokumenterad betrodd transport-/autentiseringslösning. Inga generiska osignerade webhooks godkänns. Begränsa storlek, kostnad, tidsfönster och per-tenant-/providerbudget. Inbox deduplicerar per providerkonto/händelse; urordning hanteras med källans version/observationstid. Outbox används för beslutad extern effekt. Okänt partnerutfall stäms av innan retry. Hemligheter/certifikat hanteras server-side med rotation, återkallelse och separata miljöer. OAuth-returer skyddas mot sessionsförväxling och replay med leverantörens stödda flöde. Nycklar och råtelemetri skickas inte till klientbundle eller publika loggar.

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

Inför produktionspilot ska superadminportalen även kunna visa verifieringsmetod, aktiv/tidigare fordonskoppling, tokens, beviskvalitet, avvikelseärenden och granskade beslut. Planerade rättigheter: läsa fordonskontroll, hantera verifiering, besluta ersättning, besluta tidsbundet undantag och begränsa subventionerad behörighet. Dessa är separata från rätten att läsa dagens intresseanmälningar.

## 16. Leveransfaser och acceptans

| Fas | Leverans | Acceptans för fasen |
|---|---|---|
| A | Nulägesinventering, startkit, kravregister, partner-/API-kartläggning | Källcommits, schema-/migrationskarta och kompatibilitets-/bevismatris enligt §11.3; åtkomst, kostnader och riskägare dokumenterade |
| B | Ett projekt utan monorepo | Webb och relevanta workers byggs från rotprojektet; kontrakt och tester bevarade; CI/deploy uppdaterade |
| C | Publik webb, konto och gemensam PWA | Två erbjudanden; konto/återställning; rätt arbetsyta; responsivitet och tenantnegativa fall verifierade |
| D | Abonnemang, fordonsrätt och betalning | Verifierad bil/nyttjanderätt, atomiskt byte, köp, dubbla webhookar, förnyelsefel, uppsägning och avstämning; aktiveringsluckor ger definierad rättelse |
| E | Första riktiga hemmaladdningskedja | Rätt bil/laddpunkt verifieras fysiskt; annan bil och delad box testas; resursen planeras, styrs, överstyrs och hanterar bortfall |
| F | Hemersättning | Månad reproduceras från godkänd fordonsenergi/pris; fel bil, osäker energi, dubbelimport och korrigering ger rätt utfall |
| G | Första publika laddpartner | P1/P2-kontrollprofil, fel bil, realtid/offline, samtidig hem/publik start, start/stopp/session/CDR och partneravstämning verifierade |
| H | Partnerdrift och kommersiell pilot | Isolerade partnerflöden, mänsklig granskning/invändning, API-kontrakt och återställning; mätt kontrollkvalitet och kostnadsuppföljning |
| I | Flex i skuggläge | Kapacitetsreservation, dispatchsimulering, M&V och balanserad simulerad avräkning |
| J | Extern BSP-pilot | Avtalad produkt, kvalificerade resurser, leveransspårning och verklig avräkning |
| K | Utökad energi och marknader | Varje ny resurs/marknad genomgår egen kontrakts-, säkerhets- och driftverifiering |

A–C kan förberedas medan partneravtal bearbetas. G är beroende av partneråtkomst, inte bara programmering. Lansering av ett abonnemang som inkluderar publik laddning kräver G. Fordons-/API-kraven införs i A och D–H, inte som en sen fristående säkerhetsfas. Automatisk hemersättning kräver F med verifierad fordonskvalificering. Aktivera endast kompatibla kombinationer med beslutad kontrollprofil; §17.1 ingår i respektive fasacceptans. Hela långsiktiga Flexexa behöver inte vara färdigt för en korrekt avgränsad laddpilot, men oimplementerade funktioner får inte marknadsföras som tillgängliga.

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
| FX-017 | Fordonsverifiering / identitet | Registreringsnummer/VIN/asset och nyttjanderätt verifieras; leasing, ändrad skylt och saknad källa hanteras |
| FX-018 | Fordonsrätt / subscriptions | En aktiv bil per grundabonnemang; samtidiga byten/start, ersättningsbil och historisk giltighet skyddas atomiskt |
| FX-019 | Publik auktorisering / charging | Fel bil, lånad token, P1/P2/P3, offline/whitelist och osäkert startutfall testas fysiskt och genom partner-API |
| FX-020 | Hemkvalificering / reimbursement | Annan bil i samma box ger ingen automatisk ersättning; delad box, sessionsbyte och osäker energi hanteras |
| FX-021 | Avvikelse och support | Datafel skiljs från verifierat missbruk; auditerade beslut, tidsbundna undantag och kundens invändning fungerar |
| FX-022 | Integration / kapabilitet | Versions-/modellbunden matris med verklig evidens, färskhet, kostnad, rättigheter och godkänd kvarstående risk |
| FX-023 | API-kontrakt / respektive domän | OpenAPI och konsumenttester för verifiering, fordonsbyte, auktorisering, session, underlag och granskningsbeslut |
| FX-024 | API-säkerhet / identitet och integration | Tenant-/objekt-/fältkontroll, scopes, revokering, webhookreplay och idempotens verifierade under riktiga approller |
| FX-025 | Dataskydd / identitet och kontroll | Nödvändiga fordons-/platsdata med bedömd grund, minimering, retention och isolerad historik; rättighetsflöden testade |
| FX-026 | Pilot / produkt och drift | Fysisk rätt-/fel-bilmatris hemma/publikt; mätt felacceptans/felavslag och beslutade kvalitets-/latensgränser före aktivering |

Varje implementerad rad kompletteras med exakt regelägare/filsökväg, tester, testad commit, miljö och utfall. Migrationsreplay och RLS testas med riktiga approller; ägaranslutning eller mock räcker inte. En UI-prototyp bevisar inte externa effekter.

För denna dokumentleverans körs standardens dokumentkontroll, befintligt planregister och diffkontroll. Appbuild/databasmigrationer/fysisk laddning påstås inte testade. För senare kodändringar används faktiskt befintliga scripts och relevant riskurval; nya kommandon registreras först när de finns.

### 17.1 Acceptans för fordonsbindning och API:er

FX-017–026 är **planerade**, inte godkända av dokumentgranskningen. Före beroende kommersiell aktivering ska pilotens testmatris minst visa:

| Testgrupp | Fall som måste köras | Förväntat bevis |
|---|---|---|
| Rätt bil och rätt förare | Ägd, leasad och tillåten tjänstebil; flera tillåtna förare av samma bil; ändrad registreringsskylt med samma VIN | Rätt bil godkänns utan att kräva felaktigt ägarsamband eller skapa flera fordonsrättigheter. |
| Fel bil publikt | Delad RFID, appstart för annan bil, kopierad QR och fel första Autocharge-/certifikatregistrering | P1-bindning nekar fel bil; P2:s detektion och kvarstående risk demonstreras, inte beskrivs som garanterad prevention. |
| Fel bil hemma | Bil B på samma box, byte A→B mitt i perioden, flera kontakter och två bilar nära varandra som laddar samtidigt | B:s energi ersätts inte automatiskt; osäker allokering går till granskning. |
| Käll- och kapabilitetsfel | Sovande bil, API-bortfall, återkallad OAuth, gammal GPS/laddstatus, saknat VIN och ändrat firmware-/modellstöd | Ingen falsk anklagelse eller automatisk energiaccept; begriplig fallback och återverifiering. |
| Samtidighet och okänt utfall | Två nya starter hem/publikt, dubbla bilbyten, bilbyte under start, timeout efter partnerstart och återtagen worker | En rättighetsversion och högst en ny auktoriserad fysisk session; osäkert utfall avstäms före frisläppning/ny start. |
| Partner kringgår onlineväg | Offline-RFID, whitelistcache, egen partnerapp och fördröjd revokering | Faktisk gräns dokumenterad; bara kombinationer med godkänd kontrollprofil och avtalad risk aktiveras. |
| Flera källor och ekonomi | Dubblett-/urordnade händelser, samma session via bil och laddare, sen CDR, dubbel hem/publik allokering och kreditkorrigering | Ingen dubbelersättning; historisk giltighet och partnerkostnad bevaras även under utredning. |
| API-/tenantnegativt | Fel tenant/objekt/fordon, återkallad tjänst, manipulerat `verified`, webhookreplay, fel payload under samma idempotensnyckel och missbruk av registeruppslag | Nekad handling utan korsad data eller privilegiehöjning; verkliga approller och DB-/RPC-vägar testas. |
| Byte, support och rättigheter | Såld bil, tillfällig ersättningsbil, certifikatbyte, nyttjanderätt upphör, manuellt undantag löper ut och kunden invänder | Ingen gammal behörighet/historik ärvs, auditerat tidsbundet beslut och fungerande återgång. |

Piloturvalet omfattar minst en fungerande och en nekad/otillräcklig kombination för varje kontrollprofil som ska aktiveras, och fysisk fel-bil-testning både hemma och publikt med partnerns tillåtelse. Saknat partner-/hårdvarustöd blir en avgränsad kompatibilitetslucka, inte ett test som godkänns genom mock.

Mät felaktigt godkända sessioner, felaktigt nekade legitima sessioner, andel osäkert underlag, tid till beslut/granskning, integrationskostnad och faktisk felaktigt ersatt energi. Produktansvarig och drift/ekonomi dokumenterar accepterad kvarstående risk, kvalitets-/latensgränser och ägarskap per aktiverad kombination före pilot. En kontrollprofil får inte lanseras om dessa gränser saknas eller om fysisk fordonsbindning påstås utan testbevis. Ingen data → inte automatiskt verifierad bil; hög förbrukning → inte automatiskt fel bil.

## 18. Engineering Startkit i det löpande arbetet

Antagen version: 3.0.0. Relevanta profiler: Next.js/Supabase, white-label/organisationsisolering, abonnemang/betalning, mobil/PWA och import/datautbyte. AI-profil är senarelagd tills en konkret AI-funktion väljs; ingen modell ska äga säkerhets-, styr- eller betalningsbeslut utan deterministisk verkställighet.

Dokumentkarta: PROJECT_CONTEXT beskriver stabila fakta; PROJECT_STATE är kort checkpoint; DECISIONS innehåller beslut; detta dokument äger produktutökningens krav-ID:n och fasordning. V1 och dess befintliga coverage-register bevarar övrig långsiktig kravhistorik. CI_INTEGRATION beskriver arbetssättet; verkliga kommandon och observerade utfall registreras i kontext/status.

Arbetsordning per leverans: kontrollera faktisk kod och schema → uppdatera berört krav/regelägare → implementera hela användarresan → verifiera rättighet, domänregel, databas och extern gräns → dokumentera evidens → uppdatera status. Skilj planerat, implementerat, verifierat och driftsatt.

## 19. Öppna beslut och nästa konkreta arbete

Öppet före checkout: juridisk säljare, slutlig momsvisning, betalningsleverantör, bindning/uppsägning, villkor för den planerade enbilskopplingen, tillåtna förare, byte/ersättningsbil och yrkestrafik. Öppet före hemersättning: exakta elhandelskomponenter, månadsprismodell, mätkrav, förlustregel och utbetalning kontra kvittning. Öppet före publik lansering: partneravtal, verklig täckning, avgifter, support och priset 2,80:s avtalade innebörd. Öppet före BSP-pilot: partner, kvalificering och produktkrav.

Öppet före fordonsbundet erbjudande: register-/OEM-/laddar-/CPO-åtkomst, kontrollerad första fordonsbindning, tillåtna P1/P2-kombinationer, offlinevillkor, mät-/färskhetstoleranser, manuell prövning/svarstid, avtalsföljder, dataskydd/retention och pilotens accepterade kvarstående risk. Ett registreringsnummer eller en RFID-bricka löser inte dessa frågor ensamt.

Dessa frågor stoppar endast beroende aktivering/publicering; inventering, projektomstrukturering och oberoende produktarbete fortsätter.

Nästa implementation: inventera hela foundation-grenen mot dev-databasens fullständiga schema/migreringar och main; registrera återanvändnings- och verifieringskarta; genomför därefter fas B utan att kasta befintliga modeller eller tester. Inga nya dubbla kund-, behörighets- eller Ediel-motorer ska införas.

## 20. Källor till fordons- och API-tillägget

Kontrollerade 2026-11-03. Källorna beskriver respektive leverantör/protokoll, inte ett ingånget Flexexa-avtal eller bevis på vår implementation. Kontrollprofiler och kontrollpolicy ovan är Flexexas planerade design. Verifiera konkret version, modell, fält och kontrakt vid implementation.

- [Transportstyrelsen: villkorad data och vägtrafikregistret](https://www.transportstyrelsen.se/sv/om-oss/statistik-och-analys/oppna-data/villkorad-data-utifran-trafikslag/): åtkomst till vägtrafikdata måste kartläggas mot erbjuden tjänst och gällande villkor; sidan ger inget generellt löfte om ett fritt regnummer-API.
- [OCPI 2.3.0 Sessions](https://github.com/ocpi/ocpi/blob/2.3.0/release/core/mod_sessions.asciidoc): sessionsinformationen har laddtoken, auktoriseringsreferens och laddplats. Den ska inte tolkas som ett generellt VIN-bevis.
- [OCPI 2.3.0 Tokens](https://github.com/ocpi/ocpi/blob/2.3.0/release/core/mod_tokens.asciidoc): kontraktscertifikat hanteras utanför OCPI; whitelistval påverkar realtids-/offlineauktorisering.
- [Open Charge Alliance: ISO 15118 och OCPP](https://openchargealliance.org/ocpp-info-whitepapers/using-iso-15118-plug-charge-with-ocpp-1-6/): stödet beror på den faktiska ISO 15118-/OCPP-kedjan, inte på en allmän OCPP-etikett.
- [Circle K: AutoCharge](https://www.circlek.se/laddning/autocharge): beskriver MAC-baserad identifiering och begränsningar för bland annat roaming. Stöd i egen app är inte bevis för Flexexas partnerintegration.
- [Tesla Fleet API: Vehicle Endpoints](https://developer.tesla.com/docs/fleet-api/endpoints/vehicle-endpoints): fordons-/VIN-baserade operationer och åtkomstbegränsningar; cached data kan vara gammal och saknar platsdata. Ingen generell realtids-/positionsgaranti antas.
- [Enode: modellstöd och integrationskvalitet](https://platform.enode.com/brands/learn?asset-type=charger+&asset-type=vehicle&q=): kompatibilitet, kvalitet och åtkomst behöver utvärderas per källa. Enode är ett integrationsalternativ, inte ett beslutat obligatoriskt beroende.
