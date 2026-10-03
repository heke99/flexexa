# Flexexa komplett masterplan på svenska

> Införd i repot 2026-10-02 som läsversion. Den daterade statusen nedan avser
> kontrollen 2026-10-01. Läs [aktuellt genomförande](GENOMFORANDE.md) för senare
> kandidat-, gransknings- och driftgränser. Den låsta V1 och det versionsstyrda
> V1.1-tillägget är styrande; denna läsversion ersätter inte deras krav eller
> bevisregister.

Detta är den fullständiga svenska läsversionen av Flexexas låsta masterplan V1. Den beskriver vad hela plattformen ska kunna göra, hur systemen ska samverka, vilka data som ska lagras, i vilken ordning arbetet ska genomföras och vilka bevis som krävs innan en fas får godkännas.

Samtliga 88 originalavsnitt, numrerade 0 till 87, och samtliga 14 byggfaser, numrerade 0 till 13, finns kvar. Tekniska tabellnamn, fältnamn, API-sökvägar, behörighetsnycklar och kontraktsnamn behålls på engelska för att dokumentet ska gå att använda tillsammans med kod och databas.

Underlaget kontrollerades mot GitHub den 1 oktober 2026. Den låsta basplanen är styrande. Leveranskraven från V1.1 redovisas separat sist i dokumentet eftersom PR #51 fortfarande var öppen vid kontrollen. Denna svenska läsversion ändrar inte originalplanen eller statusen på någon fas.

## Så ska planen läsas

Planen beskriver både den första användbara produkten och den långsiktiga plattformen. En komponent som nämns här kan vara planerad, delvis byggd eller verifierad inom en begränsad miljö. Att den finns i planen betyder inte att den redan körs i drift.

När vi säger att en fas är klar krävs ett fungerande sammanhängande flöde och bevis för fasens relevanta krav. En simulator visar hur mjukvaran fungerar under kontrollerade förhållanden. En fysisk test visar vad en riktig enhet faktiskt gjorde. Partnergodkännande visar att en namngiven BSP eller annan motpart accepterat den överenskomna integrationen och leveransen. Dessa bevis kan inte ersätta varandra.

Den beslutade vägen är grundplattform, riktig smart laddning, full svensk kostnadsberäkning, fler anslutningar, simulerad flexibilitet och därefter BSP-pilot. Senare faser utökar plattformen till fler BSP-partners, lokal flexibilitet, batterier och sol, Edge, fler länder och dubbelriktad laddning.

## Begrepp som återkommer

| Begrepp | Vad det betyder i Flexexa |
| --- | --- |
| Organisation | Företaget eller aktören som använder plattformen. |
| Tenant | En avgränsad kundmiljö med egna användare, kunder, enheter, behörigheter och data. En organisation kan ha flera tenants. |
| White label | Partnern använder eget varumärke, färger och domän ovanpå samma plattform. |
| Site | En fysisk plats, exempelvis bostad, depå eller laddanläggning. |
| Asset | En styrbar eller mätande resurs, exempelvis bil, laddare, batteri eller elmätare. |
| Kanonisk modell | Flexexas gemensamma interna representation av ett objekt, oberoende av leverantör. |
| Adapter | Kod som översätter en leverantörs API, fil eller protokoll till och från Flexexas gemensamma modeller. |
| BSP | Leverantör av balanstjänster. Den första marknadskopplingen sker genom en extern BSP-partner. |
| BRP | Balansansvarig part. Flexexa måste hantera rätt BRP-relation och påverkan men ska enligt basplanen inte bli BRP. |
| DSO | Elnätsföretag eller distributionsnätsoperatör. |
| TSO | Systemansvarig transmissionsnätsoperatör. |
| DERMS | Hantering och styrning av distribuerade energiresurser. |
| VPP | Samordning av många små resurser som en gemensam virtuell kraftresurs. |
| HEMS | Styrning och optimering av energianvändningen i ett hem eller en fastighet. |
| Telemetri | Tidsstämplade mätvärden och status från enheter. |
| Device shadow | Två separata bilder av enhetens önskade tillstånd och dess rapporterade tillstånd. |
| Idempotens | Samma begäran får kunna upprepas utan att samma kommando, reservation eller ekonomiska post skapas flera gånger. |
| Outbox och inbox | Beständiga mekanismer för att skicka och ta emot händelser utan att tappa eller dubbelbehandla affärseffekter. |
| Baslinje | Den versionsbestämda jämförelse som används för att bedöma hur mycket flexibilitet som levererats. |
| Settlement | Extern avräkning av marknadsleverans, avgifter och ersättningar. |
| Ledger | Flexexas ekonomiska huvudbok med balanserade debet- och kreditposter. |
| V1G | Styrning av laddning i en riktning. Minskad förbrukning är inte export från bilen. |
| V2H och V2G | Energi från bilen till fastigheten respektive elnätet. |
| Mobilitetsgaranti | Kundens laddmål ska uppnås före kundens angivna avresetid inom den fysiskt genomförbara ramen. |

## Gemensamma fält och vad de betyder

| Fält eller fältgrupp | Betydelse |
| --- | --- |
| `id` | Flexexas interna stabila identitet. |
| `tenant_id` | Vilken kundmiljö som äger raden och som behörighet måste kontrolleras mot. |
| `external_id` och andra `external_*` | Identifierare hos en leverantör eller motpart. De ersätter aldrig Flexexas interna identitet. |
| `created_at` och `updated_at` | När information skapades respektive senast ändrades. |
| `valid_from` och `valid_until` | Vilken tid en regel, relation, tariff, rättighet eller konfiguration gäller för. |
| `starts_at` och `ends_at` | Leverans- eller beräkningsintervallets början och slut. |
| `status` | Objektets tillstånd i den definierade livscykeln. |
| `version` och `checksum` | Vilken oföränderlig version som används och hur dess innehåll identifieras. |
| `source`, `quality` och rådatareferens | Var informationen kommer från och hur tillförlitlig den är. |
| `correlation_id` | Kopplar ihop en begäran med dess kommandon, händelser, beräkningar och svar. |
| `causation_id` | Identifierar vilken tidigare händelse som orsakade nästa händelse. |
| `idempotency_key` och `request_hash` | Identifierar en upprepad operation och säkerställer att samma nyckel inte används för olika innehåll. |
| `*_json` | Versionsstyrd strukturerad konfiguration eller metadata. Kärnrelationer och kärnfält ska ändå vara normaliserade. |
| `credential_reference` och `secret_arn` | Pekare till skyddade hemligheter. De är inte själva hemligheten. |

## Läget som ligger till grund för nästa byggsteg

Den huvudsakliga implementationen finns på `phase/0-foundation`. Fas 0 är fortfarande öppen. Den samlade PR #1 mot `main` är ett utkast. Webbshellen har mergats till `main` genom PR #50, men det innebär inte att en färdig produkt för fysisk laddstyrning har levererats.

PR #51 innehåller V1.1-tillägget med tio leveranskrav och 31 acceptansfall. Dess publicerade CI-checks och Vercel-status var gröna vid kontrollen, men PR:n var inte mergad. Gröna checks visar inte att de föreslagna fysiska och externa acceptansfallen redan genomförts.

Den senaste registrerade manuella AWS-apply-körningen skapade grundresurserna men underkändes i slutkontrollen av tillståndet. Rättningen är mergad. En ny godkänd körning och aktuell oberoende läsning av resurserna återstår som bevis. Här görs ingen ny kontroll av hela molnmiljön.

Nästa arbetsordning är att slutföra PR #51 enligt gällande granskningskrav, verifiera AWS-apply och kvarvarande grundkrav, och därefter genomföra fas 1 med en riktig överenskommen bil och laddare.

## 0 Produktmål

Flexexa ska vara en plattform för smart energi där många partners kan ansluta, optimera och styra små energiresurser och följa flexibilitetsleveransen ända till ekonomisk avräkning.

Plattformen ska stödja elhandelsbolag, laddartillverkare, fordonstillverkare, batteritillverkare, energitjänsteföretag, fordonsflottor, aggregatorer, BSP-partners och HEMS-leverantörer. Nätägare och lokala flexibilitetsaktörer tillkommer senare. Arkitekturen ska också kunna stödja framtida direkt marknadsåtkomst som BSP.

Flexexa använder externa BSP-partners först och ska enligt basplanen inte bli BRP. Däremot måste elhandlare, BRP, BSP, DSO, aggregator, TSO och elområde finnas som tydliga och tidsberoende relationer i modellen.

En senare övergång från `ExternalBspAdapter` till `FlexexaDirectBspAdapter` ska kunna ske utan att göra om enheter, anslutningar, telemetri, optimering, prognoser, flexibilitet, pooler, dispatch, mätning, baslinjer, verifiering, settlement eller intäktsfördelning.

Det långsiktiga dimensioneringsmålet är över en miljon anslutna resurser och hundratusentals samtidiga laddare, fördelade över flera länder, elhandlare, BSP:er, BRP:er, nätägare och flexibilitetsmarknader. Detta är ett arkitekturmål som måste bevisas stegvis genom tester. V1G byggs först; V2H, V2G och ISO 15118-20 byggs senare.

## 1 Arkitekturkrav

Följande 20 egenskaper är bindande i basplanen:

1. API ska vara en förstklassig åtkomstväg.
2. White label ska stödjas från början.
3. Kundmiljöerna ska vara separerade redan i första migrationen.
4. Gemensamma kanoniska datamodeller ska vara grunden.
5. Plattformen ska vara oberoende av anslutningsleverantör.
6. Plattformen ska vara oberoende av enskild tillverkare.
7. Plattformen ska vara oberoende av enskild BSP.
8. BRP-relationer ska hanteras utan att Flexexa själv blir BRP.
9. Landsregler ska ligga i separata country packs.
10. Asynkront arbete ska använda händelser.
11. Styrning och marknadshändelser ska kunna granskas i efterhand.
12. Ekonomiska flöden ska hålla en kvalitet som medger spårbar avräkning.
13. Kommandon, importer och externa skrivningar ska vara idempotenta.
14. Regler för energi, marknadsåtaganden och pengar ska utvärderas deterministiskt.
15. Mogna komponenter med öppen källkod ska prioriteras.
16. Anpassningar ska hållas nära originalprojekten så att uppdateringar förblir möjliga.
17. Frontend får aldrig vara källa för auktoritativt affärstillstånd.
18. Fysisk elsäkerhet har högsta prioritet.
19. Kundens mobilitetskrav har företräde framför intäktsoptimering.
20. Samma fysiska flexibilitet får aldrig säljas två gånger.

## 2 Gemensam Kernel

`Flexexa Kernel` ska användas av alla domäner. Den samlar gemensamma regler för modeller, kundmiljö, identitet, behörighet, affärspolicy, tillståndsövergångar, enheter, pengar, tid, datakällor, idempotens, revision och fel.

Kernel ansvarar också för korrelations- och orsakssamband, versionsregister, feature flags, godkännanden med oberoende granskning samt utvärdering av om en tenant är redo för en viss policyversion.

Kodområdena är `packages/kernel/canonical`, `tenancy`, `authz`, `rules`, `state-machines`, `units`, `money`, `time`, `provenance`, `idempotency`, `audit`, `errors` och `config`. Relaterade tjänster är `services/policy-service` och `services/authorization-service`.

Varje relevant begäran ska följa samma ordning: validera extern indata, normalisera till kanonisk modell, verifiera tenantägande, autentisera, kontrollera behörighet, utvärdera central policy, kontrollera domänregler och tillstånd, skriva atomiskt, skapa outbox-händelse och behålla revisionsspår.

Optimering, flexibilitet, dispatch, settlement och gränssnitt får inte innehålla egna kopior av samma affärsregler. Fysiska säkerhetsgränser, protokollregler och lokala laddgränser ligger däremot i deterministisk kod eller Edge och får inte bero på att en fjärrtjänst är tillgänglig.

## 3 Gemensamma kanoniska modeller

Följande centrala modeller ska finnas och delas mellan tjänster:

`CanonicalCustomer`, `CanonicalSite`, `CanonicalMeteringPoint`, `CanonicalAsset`, `CanonicalAssetState`, `CanonicalCapability`, `CanonicalMarketActor`, `CanonicalPriceInterval`, `CanonicalGridTariff`, `CanonicalRetailerTariff`, `CanonicalFlexProduct`, `CanonicalFlexAvailability`, `CanonicalReservation`, `CanonicalCommitment`, `CanonicalActivation`, `CanonicalDispatch`, `CanonicalMeasurement`, `CanonicalBaseline`, `CanonicalSettlement`, `CanonicalLedgerTransaction`, `CanonicalConsent`, `CanonicalDecision` och `CanonicalEvent`.

Tesla, Enode, OCPP och OEM-API:er ska alla normaliseras till samma interna enhetstillstånd. Samma princip gäller BSP-data, settlement, tariffer, priser, väder, elmätare och lokal flexibilitet.

Modellerna ligger i `packages/domain`, `packages/api-contracts`, `packages/events` och `packages/kernel/canonical`. HTTP-kontrakt dokumenteras med OpenAPI, payloads med JSON Schema och händelser med AsyncAPI. TypeScript använder Zod eller motsvarande validering. Python använder Pydantic eller modeller som är kompatibla med JSON Schema.

Leverantörens payload får sparas som rådata för spårbarhet, men får inte bli plattformens interna domänmodell. Ingen tjänst får skapa en egen inkompatibel kopia av en kanonisk enum eller DTO.

## 4 Identifierare enheter pengar och tid

- Interna identifierare är UUID. UUIDv7 föredras när det genereras av server eller applikation; UUIDv4 är tillåten reserv.
- Databastid lagras som `timestamptz` i UTC. Lokala scheman har alltid en IANA-tidszon.
- Intervall är halvöppna: början ingår, slutet ingår inte. Formen är `[starts_at, ends_at)`.
- Effekt anges i kW, energi i kWh, ström i A, spänning i V och SOC i procent mellan 0 och 100.
- Valuta använder ISO 4217 och land använder ISO 3166-1 alpha-2.
- Pengar lagras som decimal eller hela minsta valutaenheter. Flyttal får inte användas för ekonomiska belopp.
- Effekt och energi i ekonomisk avräkning använder decimalprecision. Telemetrianalys får använda flyttal om precisionen dokumenteras.
- Enumvärden skrivs i `lowercase_snake_case`.
- Externa identifierare hålls åtskilda från Flexexa-ID:n.
- JSON får innehålla leverantörsdata och utökad metadata men får inte ersätta normaliserade kärnkolumner.

## 5 Tenantägande

Varje affärsrad som ägs av en tenant ska ha `tenant_id uuid NOT NULL REFERENCES tenants(id)`.

Det omfattar kunder, platser, mätpunkter, enheter, enhetsanslutningar, leverantörskonton, laddpreferenser, laddplaner, optimeringskörningar, flexibilitetsportföljer, reservationer, åtaganden, dispatch, tenantägd settlement, kundbelöningar, samtycken, API-klienter, webhooks, revisionshändelser, regelbindningar, konfigurationsbindningar och feature flags.

En tenantägd rad får aldrig sakna tenant. Undantag måste vara uttryckligt globala kataloger, exempelvis behörighetsdefinitioner, länder, gemensamma elområden, leverantörsdefinitioner och generiska produktmallar.

## 6 Databasen ska förhindra felaktiga tenantrelationer

Databasen måste garantera att en plats tillhör samma tenant som dess kund, att en enhet tillhör samma tenant som plats och kund, och att en normal portfölj inte får innehålla en annan tenants enhet.

Använd sammansatta främmande nycklar. Kunden ska exempelvis ha en unik kombination av `tenant_id` och `id`, och platsens `tenant_id, customer_id` ska referera just denna kombination.

```sql
ALTER TABLE customers
  ADD CONSTRAINT customers_tenant_id_id_key UNIQUE (tenant_id, id);

ALTER TABLE sites
  ADD CONSTRAINT sites_tenant_id_id_key UNIQUE (tenant_id, id),
  ADD CONSTRAINT sites_customer_same_tenant_fk
  FOREIGN KEY (tenant_id, customer_id)
  REFERENCES customers (tenant_id, id);
```

Mönstret används på alla tenantägda relationer. Normala skrivningar får aldrig skapa kund A med plats B, plats A med enhet B, enhet A i portfölj B eller leverantörskonto A med enhetsanslutning B. Vanliga användare får inte ändra `tenant_id` efter att raden skapats.

## 7 Organisation och tenant

En organisation kan ha flera tenants. Tenant är ägandets källa för tenantägda rader.

`organization_id` ska inte dupliceras överallt när det kan härledas genom tenant. Om båda fälten behövs för rapportering eller prestanda ska databasen också kontrollera att tenantens organisation är samma som radens organisation. Två osynkroniserade ägarfält får aldrig användas som parallella sanningar.

## 8 Aggregering mellan tenants

Aggregering över flera tenants ska göras genom en särskilt privilegierad `platform-aggregation-service` med egen tjänsteidentitet och uttryckliga rättigheter.

Aggregeringen får bara ske när tenantavtal, kundsamtycken och eventuella elhandlaravtal är giltiga, kombinationen av BSP, BRP och DSO är tillåten, marknadsprodukten medger aggregering och det finns ett uttryckligt tillåtet omfång.

Varje operation ska registrera deltagande tenant-ID:n, skapa oföränderligt revisionsspår och bevara varje tenants, kunds och enhets bidrag. Vanlig RLS får inte stängas av för att få aggregeringen att fungera.

## 9 Central policy och regelmotor

Regelmotorn ska vara central och versionsstyrd. Den ska hantera följande regelområden:

- Elsäkerhetsrelaterad styrpolicy, kommandoprioritet, mobilitetsgaranti och kundens manuella överstyrning.
- Samtycke, enhetsbehörighet, marknadsbehörighet och förkvalificering.
- Portföljsegmentering och kombinationer över tenants, elhandlare, BSP:er, BRP:er och nätägare.
- Säkerhetsavdrag på kapacitet, överbokningsgränser, enhetsval vid dispatch och omfördelning vid fel.
- Leverantörsval, reservvägar, tariffberäkning, skatt och optimeringsbegränsningar.
- Marknadsbud, matchning av settlement, intäktsfördelning, fördelning av sanktioner och BRP-kompensation.
- Dataskydd och retention, datakvalitet, gamla mätvärden, notifieringar och incidenthantering.

Ingen språkmodell får fatta auktoritativa beslut om fysisk energi, marknadsåtaganden, ekonomisk avräkning eller behörighet. Dessa beslut ska vara deterministiska och möjliga att reproducera.

## 10 Regler och policyer fält för fält

`rule_definitions` beskriver vilken regel som finns och hur den får användas. Fält: `id`, `rule_key`, `domain`, `name`, `description`, `scope_type`, `rule_type`, `input_schema_json`, `output_schema_json`, `default_effect`, `overridable_by_tenant`, `criticality`, `execution_mode`, `status`, `created_at`, `updated_at`.

`rule_versions` lagrar en viss oföränderlig regelversion. Fält: `id`, `rule_definition_id`, `version`, `expression_language`, `expression_json`, `configuration_json`, `checksum`, `status`, `valid_from`, `valid_until`, `created_by`, `approved_by`, `approved_at`, `created_at`.

Tillåtna regelstatusar är `draft`, `testing`, `approved`, `published`, `deprecated` och `retired`. En publicerad version får inte redigeras. En ändring ska skapa en ny version.

`policy_sets` grupperar regler för ett gemensamt syfte. Fält: `id`, `policy_key`, `domain`, `name`, `description`, `criticality`, `status`, `created_at`, `updated_at`.

`policy_set_versions` lagrar policypaketets version. Fält: `id`, `policy_set_id`, `version`, `status`, `checksum`, `valid_from`, `valid_until`, `created_by`, `approved_by`, `approved_at`, `created_at`.

`policy_set_rule_versions` kopplar paketversionen till exakta regelversioner. Fält: `id`, `policy_set_version_id`, `rule_version_id`, `priority`, `required`, `configuration_json`.

`rule_bindings` anger var en viss regelversion gäller. Fält: `id`, `tenant_id`, `rule_definition_id`, `rule_version_id`, `scope_type`, `scope_id`, `priority`, `override_mode`, `valid_from`, `valid_until`, `status`, `created_by`, `created_at`, `updated_at`.

Tillåtna regelomfång är `platform`, `country`, `market_area`, `market_provider`, `market_product`, `market_actor`, `tenant`, `site`, `asset_type`, `asset`, `customer` och `portfolio`. Tenant får bara göra en tillåten anpassning när `overridable_by_tenant=true`.

## 11 Regelprioritet

Reglernas auktoritet är följande:

1. Fysiska säkerhetsgränser.
2. Obligatoriska nationella eller regulatoriska regler.
3. Produktkrav från marknad, TSO eller DSO.
4. Avtalskrav från BSP, BRP eller elhandlare.
5. Obligatorisk plattformspolicy.
6. Tenantpolicy.
7. Policy för plats eller enhet.
8. Kundpreferens.
9. Optimerarens preferens.

Ett säkerhetsförbud eller bindande regulatoriskt förbud får inte åsidosättas av en lägre nivå. För numeriska gränser vinner normalt den säkraste effektiva gränsen. Om plattformen medger 11 kW, tenant 9 kW och kund 7 kW blir den effektiva gränsen 7 kW.

Konfliktlösningen ska beskrivas i regeldefinitionen och ha tester.

## 12 Kontrakt för regelutvärdering

`DecisionRequest` ska innehålla `tenant_id`, `policy_key`, `effective_at`, autentiserad aktörstyp och aktörs-ID, subjektets typ och ID, resursens typ och ID, kanoniska fakta och kontext samt `correlation_id`.

`DecisionResponse` ska innehålla `evaluation_id`, `decision`, `allowed` där det är relevant, `constraints_json`, `computed_json`, `reason_codes`, `applied_rule_versions`, `policy_set_version_id`, `evaluated_at` och `expires_at`. Beslutets typ är `allow`, `deny`, `limit`, `select` eller `calculated`.

`rule_evaluations` lagrar revisionsunderlaget. Fält: `id`, `tenant_id`, `policy_set_version_id`, `subject_type`, `subject_id`, `resource_type`, `resource_id`, `effective_at`, `input_hash`, `input_snapshot_reference`, `decision`, `result_json`, `reason_codes_json`, `applied_rule_versions_json`, `correlation_id`, `latency_ms`, `evaluated_at`.

Stora volymer av detaljer får arkiveras i ClickHouse och S3. Affärskritiska beslut måste ändå ha en beständig referens till rätt utvärdering.

## 13 Signerade policybilder för styrning och Edge

Styrtjänsten och Edge ska inte behöva göra en fjärrfråga mot databasen för varje realtidskommando. Policytjänsten publicerar versionsstyrda signerade snapshots med händelsen `policy.snapshot.published`.

Snapshotfält: `tenant_id`, `scope`, `policy_set_version_id`, `rules_checksum`, `valid_from`, `valid_until`, `compiled_constraints`, `signature`.

Control Service cachar dessa i Valkey eller minne. Edge lagrar bara den policy som krävs lokalt. Vid avbrott används senaste fortfarande giltiga snapshot. Om den har löpt ut används en säkrare reservstrategi. Lokala fysiska säkerhetsgränser gäller alltid.

## 14 Regeltester och tenantens beredskap

`rule_test_cases` innehåller `id`, `rule_version_id`, `name`, `input_json`, `expected_json`, `status` och `created_at`.

En kritisk regel ska gå från utkast genom automatiserade tester, skuggutvärdering, oberoende godkännande och publicering. Därefter utvärderas berörda tenants på nytt.

`tenant_policy_readiness` innehåller `id`, `tenant_id`, `policy_set_version_id`, `status`, `blocking_reasons_json`, `warning_reasons_json`, `evaluated_at`, `evaluator_version`, `created_at`, `updated_at`.

Statusar: `pending`, `ready`, `ready_with_warnings`, `blocked`, `superseded`. En ny relevant policyversion kräver ett nytt beredskapsresultat för varje berörd tenant. Gammal beredskap får inte återanvändas för den nya versionen.

## 15 Behörighetsmodell fält för fält

`permissions` beskriver enskilda rättigheter. Fält: `id`, `permission_key`, `domain`, `action`, `description`, `scope_type`, `risk_level`, `requires_mfa`, `requires_step_up`, `status`, `created_at`, `updated_at`.

`roles` grupperar rättigheter. Fält: `id`, `tenant_id`, `role_key`, `name`, `description`, `scope_type`, `is_system_role`, `status`, `created_at`, `updated_at`.

`role_permissions` kopplar rättighet till roll. Fält: `id`, `role_id`, `permission_id`, `effect`, `condition_json`, `valid_from`, `valid_until`, `created_at`.

`memberships` beskriver användarens medlemskap. Fält: `id`, `tenant_id`, `user_id`, `status`, `valid_from`, `valid_until`, `invited_by`, `created_at`, `updated_at`. Aktivt medlemskap ska vara unikt för `tenant_id + user_id`.

`membership_roles` innehåller `id`, `membership_id`, `role_id`, `valid_from`, `valid_until`, `created_by`, `created_at`. Databasen ska kontrollera att roll och medlemskap hör till samma tenant.

`membership_permission_overrides` innehåller `id`, `membership_id`, `permission_id`, `effect`, `condition_json`, `reason`, `valid_from`, `valid_until`, `created_by`, `approved_by`, `created_at`. Direkta undantag används sparsamt och ska alltid granskas i revisionsspåret.

`service_identities` innehåller `id`, `service_key`, `name`, `service_type`, `status`, `created_at`, `updated_at`.

`service_identity_tenant_grants` innehåller `id`, `service_identity_id`, `tenant_id`, `permission_id`, `scope_json`, `valid_from`, `valid_until`, `created_at`. Den anger vilka resurser och tenants en tjänst får arbeta med.

`api_clients` innehåller `id`, `tenant_id`, `name`, `client_type`, `client_id`, `secret_hash`, `status`, `expires_at`, `last_used_at`, `created_by`, `created_at`, `updated_at`.

`api_client_permissions` innehåller `id`, `api_client_id`, `permission_id`, `condition_json`, `valid_from`, `valid_until`.

## 16 Standardroller

| Roll | Avsett ansvar och begränsning |
| --- | --- |
| `superadmin` | Högsta tillfälliga plattformsåtkomst för nödsituationer, regler, incidenter och revision. MFA och förstärkt autentisering krävs. Används inte till dagligt arbete. |
| `platform_admin` | Organisationer, tenants, integrationer, konfiguration, marknadsaktörer och leverantörshälsa. Har inte automatiskt ansvar för hemligheter eller nödsäkerhetsåtkomst. |
| `tenant_admin` | Egen tenants användare, roller, kunder, platser, enheter, integrationer, tariffer och tillåtna inställningar. Ingen implicit åtkomst över tenantgränser. |
| `operator` | Driftvy, enheter, kommandohistorik, tillåtna kommandon, optimering, incidenter och operativ flexibilitet. Får inte godkänna settlement som standard. |
| `market_operator` | Portföljer, tillgänglighet, bud, åtaganden, dispatch och leveransverifiering. Högriskåtgärder kan kräva godkännande och förstärkt autentisering. |
| `finance` | Settlement, avstämning, intäktsfördelning, belöningar och läsning av ledger. Ingen enhetsstyrning. |
| `settlement_approver` | Godkännande av avstämningar och justeringar inom tillåtna gränser. Får inte själv godkänna egen justering när oberoende granskning krävs. |
| `support` | Minimerad kundinformation, platser, enheter, anslutningshälsa och säkra supportåtgärder. Inga marknadsåtaganden, ledgerposter eller regelpubliceringar. |
| `developer` | API-klienter, webhooks, sandbox och integrationskonfiguration. Ingen styrning av produktionsenheter som standard. |
| `security_admin` | Säkerhetskonfiguration, åtkomstgranskning, nödsessioner och säkerhetsrevision. Hålls åtskild från finans och marknad där det är möjligt. |
| `viewer` | Läsning inom uttryckligen tilldelad tenant och domän. |

## 17 Behörighetskatalog

Minimikatalogen ska innehålla följande nycklar:

- Tenant och användare: `tenants.read`, `tenants.manage`, `users.read`, `users.invite`, `users.manage`, `roles.read`, `roles.manage`.
- Kund och plats: `customers.read`, `customers.write`, `customers.export`, `sites.read`, `sites.write`.
- Enheter och integrationer: `assets.read`, `assets.write`, `assets.control`, `assets.emergency_control`, `integrations.read`, `integrations.manage`.
- Priser och optimering: `prices.read`, `tariffs.read`, `tariffs.manage`, `optimizer.read`, `optimizer.run`.
- Flexibilitet: `flex.read`, `flex.manage`, `flex.reserve`, `flex.submit_bid`, `flex.accept_commitment`, `flex.dispatch`, `flex.override_dispatch`.
- Förkvalificering: `prequalification.read`, `prequalification.manage`.
- Ekonomi: `settlement.read`, `settlement.import`, `settlement.reconcile`, `settlement.approve`, `ledger.read`, `ledger.post`, `ledger.adjust`, `rewards.read`, `rewards.manage`.
- Regler: `rules.read`, `rules.draft`, `rules.bind`, `rules.approve`, `rules.publish`.
- API och webhooks: `api_clients.read`, `api_clients.manage`, `webhooks.read`, `webhooks.manage`.
- Revision, incidenter och säkerhet: `audit.read`, `audit.export`, `incidents.read`, `incidents.manage`, `security.manage`.

Ett uttryckligt förbud vinner över ett tillstånd på samma eller lägre auktorisationsnivå.

## 18 Funktioner för auktorisation

Minst följande databasfunktioner ska finnas:

```sql
flexexa_is_tenant_member(p_tenant_id uuid) returns boolean
flexexa_has_role(p_tenant_id uuid, p_role_key text) returns boolean
flexexa_has_permission(p_tenant_id uuid, p_permission_key text) returns boolean
flexexa_effective_permissions(p_tenant_id uuid) returns setof text
flexexa_assert_permission(p_tenant_id uuid, p_permission_key text) returns void
flexexa_is_platform_admin() returns boolean
flexexa_is_superadmin() returns boolean
```

Resursmedveten kontroll ska göras med `flexexa_authorize(p_tenant_id uuid, p_permission_key text, p_resource_type text default null, p_resource_id uuid default null, p_context jsonb default '{}'::jsonb) returns jsonb`. Svaret ska vara ett kanoniskt auktorisationsbeslut med orsakskoder.

Funktioner med `SECURITY DEFINER` ska ha fast `search_path`, minsta möjliga rättigheter och säker parameterisering om dynamisk SQL behövs. De får inte lita på användar-ID som anroparen skickat in. Identiteten ska komma från `auth.uid()` eller validerad tjänsteidentitet. Rekursiv RLS och otillåtna anrop ska testas.

## 19 Radsäkerhet

Alla exponerade tenanttabeller ska ha RLS. Läsning kräver rätt tenant, aktivt medlemskap och nödvändig behörighet. Skrivning kräver dessutom verifierat ägande, oföränderlig tenantrelation och en tillåten tillståndsövergång.

Kritiska ändringar görs genom transaktionella RPC:er eller applikationstjänster. RLS ensam bevisar inte att alla affärsinvarianter är uppfyllda.

Supabase `service_role` får aldrig exponeras för frontend. Vanliga tjänster ska så långt det är möjligt använda egna identiteter och begränsade omfång.

## 20 Transaktionella RPC:er

RPC eller lagrade procedurer används när flera rader och affärsregler måste uppdateras atomiskt. Enkla läsningar behöver inte göras om till RPC.

En skriv-RPC ska identifiera autentiserad aktör, kontrollera tenant och behörighet, validera kanonisk indata, ta nödvändiga radlås eller rådgivande lås, verifiera tillståndsövergång, utvärdera central policy där det behövs, genomföra ändringen atomiskt och skapa audit och outbox-händelse. Svaret ska följa gemensamt kontrakt.

## 21 Obligatoriska RPC-operationer

| Område | Operationer |
| --- | --- |
| Medlemskap och roller | `flexexa_create_membership`, `flexexa_assign_role`, `flexexa_revoke_role`, `flexexa_set_permission_override` |
| Kund plats och enhet | `flexexa_create_customer`, `flexexa_create_site`, `flexexa_create_metering_point`, `flexexa_create_asset`, `flexexa_link_asset_connection`, `flexexa_move_asset_between_sites` |
| Samtycke och preferenser | `flexexa_grant_consent`, `flexexa_revoke_consent`, `flexexa_set_charging_preferences` |
| Kommandon | `flexexa_request_asset_command`, `flexexa_cancel_asset_command` |
| Marknadsrelationer | `flexexa_set_site_actor_relationship`, `flexexa_close_site_actor_relationship` |
| Reservationer | `flexexa_create_flex_reservation`, `flexexa_release_flex_reservation` |
| Åtaganden | `flexexa_create_flex_commitment`, `flexexa_accept_flex_commitment`, `flexexa_cancel_flex_commitment` |
| Dispatch | `flexexa_record_dispatch`, `flexexa_allocate_dispatch`, `flexexa_acknowledge_dispatch`, `flexexa_complete_dispatch` |
| Mätning och verifiering | `flexexa_record_delivery_measurement`, `flexexa_finalize_delivery_verification` |
| Settlement | `flexexa_import_settlement_statement`, `flexexa_reconcile_settlement`, `flexexa_approve_settlement` |
| Ledger | `flexexa_post_ledger_transaction`, `flexexa_post_ledger_adjustment` |
| Regler och policy | `flexexa_create_rule_version`, `flexexa_publish_rule_version`, `flexexa_create_policy_set_version`, `flexexa_publish_policy_set_version`, `flexexa_bind_rule`, `flexexa_evaluate_tenant_policy_readiness` |

Externt initierade skrivningar ska stödja `idempotency_key` och `correlation_id` där det är relevant.


## 22 Idempotens

`idempotency_records` innehåller `id`, `tenant_id`, `actor_type`, `actor_id`, `operation_key`, `idempotency_key`, `request_hash`, `response_reference`, `status`, `created_at` och `expires_at`.

Den unika kombinationen är tenant, aktörstyp, aktörs-ID, operation och idempotensnyckel. Samma nyckel med samma innehåll ska kunna återanvändas utan en ny affärseffekt. Samma nyckel med ett annat `request_hash` ska avvisas med `IDEMPOTENCY_CONFLICT`.

Detta ska fungera även vid parallella anrop, återförsök och avbrott efter att en extern motpart mottagit operationen men innan Flexexa fått svaret.

## 23 Gemensamma tillståndsmaskiner

Tillåtna tillståndsövergångar ska definieras centralt för leverantörsanslutning, enhetskommando, laddplan, flexibilitetsreservation, marknadsåtagande, dispatch, förkvalificering, settlement, avstämning, kundbelöning, samtycke, incident, regelversion och policyversion.

Exempel på kommandots normala tillstånd är `requested`, `validated`, `queued`, `sent`, `acknowledged`, `executing`, `measurement_confirmed` och `completed`. Alternativa sluttillstånd är `failed`, `expired` och `cancelled`.

En leverantörskvittens är ett separat steg från en uppmätt ändring. Otillåtna övergångar ska avvisas på serversidan.

## 24 Godkännanden och tillfällig nödåtkomst

`approval_requests` innehåller `id`, `tenant_id`, `request_type`, `resource_type`, `resource_id`, `requested_by`, `required_approvals`, `status`, `expires_at`, `created_at`, `completed_at`.

`approval_decisions` innehåller `id`, `approval_request_id`, `decided_by`, `decision`, `reason`, `created_at`.

Godkännanden ska användas enligt konfigurerad policy för kritiska regelpubliceringar, stora marknadsåtaganden, settlementjusteringar över gränsvärde, nödsessioner och destruktiva tenantoperationer. Den som begär åtgärden får inte själv godkänna den när två oberoende personer krävs.

`break_glass_sessions` innehåller `id`, `user_id`, `reason`, `scope_json`, `approved_by`, `starts_at`, `expires_at`, `status`, `created_at`.

Nödåtkomst ska ha uttryckligt skäl, kort giltighet, MFA eller förstärkt autentisering, oföränderligt revisionsspår, larm och granskning efter användning.

## 25 Gemensamma felkoder

| Felkod | Betydelse |
| --- | --- |
| `TENANT_MISMATCH` | Ägandet stämmer inte mellan tenant och resurs. |
| `PERMISSION_DENIED` | Aktören saknar nödvändig rättighet. |
| `POLICY_DENIED` | Central policy förbjuder åtgärden. |
| `INVALID_STATE_TRANSITION` | Objektet får inte gå till det begärda tillståndet. |
| `CONSENT_REQUIRED` | Nödvändigt giltigt samtycke saknas. |
| `ASSET_OFFLINE` | Resursen saknar fungerande anslutning. |
| `STALE_TELEMETRY` | Mätdata är för gammal för beslutet. |
| `CAPABILITY_UNSUPPORTED` | Resursen stöder inte åtgärden. |
| `MOBILITY_GUARANTEE_BLOCK` | Åtgärden skulle äventyra kundens laddmål. |
| `FLEX_ALREADY_RESERVED` | Kapaciteten är redan reserverad. |
| `MARKET_INELIGIBLE` | Resursen eller poolen får inte delta i produkten. |
| `PREQUALIFICATION_REQUIRED` | Nödvändig förkvalificering saknas. |
| `BSP_ROUTE_UNAVAILABLE` | Giltig BSP-väg saknas. |
| `SETTLEMENT_MISMATCH` | Avräkningen stämmer inte med underlaget. |
| `LEDGER_UNBALANCED` | Debet och kredit balanserar inte. |
| `PROVIDER_RATE_LIMITED` | Leverantörens anropsgräns har nåtts. |
| `IDEMPOTENCY_CONFLICT` | Nyckeln har redan använts för annat innehåll. |

Leverantörsspecifika fel ska normaliseras innan de lämnas genom Flexexas externa API.

## 26 Konfigurationsregister

Feature flags svarar på om en produktfunktion är påslagen. Affärsregler svarar på om en åtgärd är tillåten, hur den begränsas och hur ett resultat ska beräknas. En påslagen funktion får därför inte kringgå regler eller behörigheter.

`configuration_definitions` innehåller `id`, `config_key`, `domain`, `schema_json`, `scope_type`, `sensitive`, `status`.

`configuration_versions` innehåller `id`, `configuration_definition_id`, `version`, `value_json`, `checksum`, `valid_from`, `valid_until`, `status`, `created_by`, `approved_by`, `created_at`.

`configuration_bindings` innehåller `id`, `tenant_id`, `configuration_version_id`, `scope_type`, `scope_id`, `priority`, `valid_from`, `valid_until`.

Exempel är leverantörstimeout, antal återförsök, gräns för gamla mätdata, reservmarginal, webhookstrategi och intervall för prognosuppdatering. Hemligheter lagras i AWS Secrets Manager.

## 27 Gemensamma läsvyer

Följande tenantseparerade läsmodeller ska skapas där de behövs:

- `v_effective_site_market_actors`: vilka marknadsaktörer som gäller för en plats vid rätt tid.
- `v_effective_asset_capabilities`: vilka förmågor enheten faktiskt har.
- `v_asset_market_eligibility`: om enheten får delta och varför.
- `v_asset_current_provider`: aktuell giltig leverantörsväg.
- `v_portfolio_remaining_capacity`: kapacitet efter reservationer.
- `v_customer_effective_consents`: kundens aktuella tillåtna användning.
- `v_tenant_effective_permissions`: tenantens effektiva rättigheter.
- `v_effective_rule_bindings`: gällande regelversioner och bindningar.

Tjänster ska återanvända dessa modeller i stället för att skapa egna varianter av samma komplicerade join.

## 28 Molnarkitektur och backendtjänster

Primär AWS-region är `eu-north-1` i Stockholm. Kritisk backend och fysisk styrning körs på ECS och Fargate.

| Tjänsteområde | Tjänster |
| --- | --- |
| Åtkomst och grunddata | `api-gateway`, `identity-service`, `tenant-service`, `asset-service` |
| Anslutning och styrning | `connector-service`, `control-service`, CitrineOS |
| Priser och laddkostnad | `price-service`, `tariff-service`, `true-cost-service` |
| Optimering och prognoser | `optimizer`, `forecasting-service` |
| Flexibilitet och marknad | `flexibility-service`, `pool-service`, `market-service`, `bsp-gateway`, `dispatch-service` |
| Mätning och godkännande | `measurement-service`, `baseline-service`, `verification-service`, `prequalification-service` |
| Ekonomi | `settlement-service`, `revenue-service`, `ledger-service` |
| Regler och efterlevnad | `compliance-service`, `policy-service` |
| Asynkront och kommunikation | `webhook-service`, `notification-service`, `worker-service`, `simulator-service` |

Detta är tydliga domängränser, inte ett krav på en separat driftsättning för varje enkel CRUD-funktion från första dagen. Flera områden får dela deployment tidigt om ansvar, kontrakt och dataägande förblir tydliga.

Infrastrukturen ska använda ECR för containerbilder, VPC, privata applikations- och datasubnät, Secrets Manager, KMS, S3, WAF och IAM med minsta möjliga rättighet.

Containerbilder ska vara versionsbestämda, skannade, ha SBOM och signeras där det är praktiskt möjligt. Produktion får inte peka på en föränderlig `latest`-tagg.

## 29 Var olika data ska lagras

| System | Auktoritativt ansvar |
| --- | --- |
| PostgreSQL och Supabase | Affärstransaktioner, Auth, RLS, kunder, tenants, behörigheter, settlement, ledger och lämpliga mindre affärsdokument. |
| ClickHouse | Stora tidsserier för effekt, SOC, elmätning, spänning, ström, tillståndshistorik, optimeringsanalys, flexrespons, kommandofördröjning och energiflöde. |
| S3 | Råhändelser, marknadspayloads, settlementfiler, oföränderlig auditexport, tariffimport, telemetriarkiv, replaydata, firmware, efterlevnadsunderlag och stora exporter eller backuper. |
| Valkey | Snabb cache för enhetstillstånd och närvaro, distribuerade lås, anropsgränser, kortvarig idempotenscache, kommandolås, leverantörsgränser, policybilder och scheman. |

Valkey får aldrig vara den beständiga källan för affärstillstånd. Stora råtelemetriströmmar ska inte belasta affärsdatabasen.

## 30 Telemetrischema i ClickHouse

Minimifält är `tenant_id`, `organization_id` där det behövs, `site_id`, `asset_id`, `provider_id`, `event_time`, `ingested_at`, `metric`, `value_float`, `value_string`, `value_bool`, `unit`, `source`, `quality`, `sequence_number`, `correlation_id`, `tags`.

`event_time` är när observationen inträffade; `ingested_at` är när Flexexa tog emot den. Mätvärdestyp och enhet måste vara uttryckliga. Pseudonyma enhets-ID:n ska användas där det är möjligt.

Senare byggs materialiserade vyer för effekt, SOC, uppmätt energi, spänning, ström, laddarstatus och flexrespons.

## 31 Händelser och meddelandebuss

RabbitMQ ska användas, initialt Amazon MQ för RabbitMQ.

Det gemensamma händelsekuvertet innehåller `event_id`, `event_type`, `event_version`, `occurred_at`, `received_at`, `tenant_id`, `organization_id` där det behövs, `correlation_id`, `causation_id`, `source`, `payload`.

Minsta händelsekatalog är:

- Enheter och telemetri: `asset.connected`, `asset.disconnected`, `asset.state.updated`, `telemetry.received`, `vehicle.connected`, `vehicle.disconnected`.
- Priser och tariffer: `price.updated`, `tariff.updated`.
- Optimering: `optimization.requested`, `optimization.started`, `optimization.completed`, `optimization.failed`.
- Laddplaner: `plan.created`, `plan.activated`, `plan.invalidated`.
- Kommandon: `command.requested`, `command.sent`, `command.acknowledged`, `command.completed`, `command.failed`, `command.expired`.
- Flexibilitet: `flex.availability.updated`, `flex.reservation.created`, `flex.reservation.released`, `flex.commitment.created`, `flex.commitment.accepted`, `flex.dispatch.received`, `flex.dispatch.acknowledged`, `flex.delivery.completed`.
- Ekonomi: `settlement.statement.received`, `settlement.reconciled`, `settlement.completed`, `reward.created`.
- Drift: `incident.created`, `provider.health.changed`.
- Regler: `rule.version.published`, `policy.version.published`, `policy.binding.changed`, `configuration.version.published`, `policy.snapshot.published`.

Alla mottagare ska vara idempotenta. Använd transaktionell outbox, inbox med deduplicering, återförsök, dead-letter-köer och versionsstyrda händelser.

## 32 Organisationer tenants och varumärken fält för fält

`organizations` innehåller `id`, `name`, `slug`, `organization_number`, `vat_number`, `organization_type`, `country_code`, `timezone`, `currency`, `status`, `created_at`, `updated_at`.

`organization_type` kan vara `platform`, `retailer`, `charger_oem`, `vehicle_oem`, `aggregator`, `bsp`, `brp`, `dso`, `tso`, `energy_service_provider`, `fleet` eller `partner`.

`tenants` innehåller `id`, `organization_id`, `brand_id`, `name`, `slug`, `country_code`, `default_market_area_id`, `status`, `created_at`, `updated_at`.

`brands` innehåller `id`, `organization_id`, `name`, `slug`, `logo_light_url`, `logo_dark_url`, `primary_color`, `secondary_color`, `accent_color`, `font_family`, `favicon_url`, `support_name`, `support_email`, `support_phone`, `default_locale`, `default_currency`, `default_timezone`, `terms_url`, `privacy_url`, `created_at`, `updated_at`.

`brand_domains` innehåller `id`, `brand_id`, `hostname`, `type`, `verification_status`, `verification_token`, `is_primary`, `created_at`, `verified_at`. En domän ska verifieras innan den används för ett varumärke. Domännamnet är inte behörighetsbevis.

`feature_flags` innehåller `id`, `tenant_id`, `feature_key`, `enabled`, `configuration_json`, `valid_from`, `valid_until`.

Exempel på funktioner är `smart_charging`, `true_cost`, `flex_rewards`, `solar`, `battery`, `v2g`, `vehicle_integration` och `native_app`.

## 33 Kunder platser och mätpunkter fält för fält

`customers` innehåller `id`, `tenant_id`, `external_customer_id`, `customer_type`, `first_name`, `last_name`, `company_name`, `organization_number`, `email`, `phone`, `locale`, `timezone`, `status`, `created_at`, `updated_at`.

`sites` innehåller `id`, `tenant_id`, `customer_id`, `name`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country_code`, `latitude`, `longitude`, `timezone`, `market_area_id`, `main_fuse_amps`, `phase_count`, `max_import_kw`, `max_export_kw`, `status`, `created_at`, `updated_at`.

Platsens huvudsäkring, fasantal och import- eller exportgränser är begränsningar som laddning och flexibilitet måste respektera.

`metering_points` innehåller `id`, `tenant_id`, `site_id`, `external_metering_point_id`, `metering_point_type`, `grid_area_code`, `market_area_id`, `measurement_resolution_minutes`, `import_enabled`, `export_enabled`, `status`, `valid_from`, `valid_until`.

Mätpunkten knyter samman den fysiska platsen med mätning, elområde, nätområde och marknadens avräkningsgräns.

## 34 Marknadsaktörer och historiska relationer

Marknadsaktörer är separata från organisationer i SaaS-plattformen. Ett företag kan vara plattformskund utan att det ensamt beskriver företagets marknadsroll vid en viss mätpunkt.

`market_actors` innehåller `id`, `name`, `actor_type`, `organization_number`, `eic_code`, `gln`, `ediel_id`, `country_code`, `external_identifiers_json`, `status`, `valid_from`, `valid_until`, `created_at`, `updated_at`.

`actor_type` kan vara `retailer`, `brp`, `bsp`, `aggregator`, `dso`, `tso`, `market_operator` eller `oem`.

`market_actor_relationships` innehåller `id`, `from_actor_id`, `to_actor_id`, `relationship_type`, `market_area_id`, `product_id`, `contract_reference`, `configuration_json`, `valid_from`, `valid_until`, `status`, `created_at`, `updated_at`.

`site_actor_relationships` innehåller `id`, `tenant_id`, `site_id`, `metering_point_id`, `market_actor_id`, `role`, `contract_reference`, `valid_from`, `valid_until`, `source`, `verified_at`, `created_at`. Rollen är `retailer`, `brp`, `bsp`, `aggregator` eller `dso`.

Systemet ska kunna svara på exakt vilken elhandlare, BRP, BSP, DSO och aggregatorrelation som gällde vid ett historiskt klockslag. Ett senare leverantörsbyte får inte skriva om gamla leveranser eller settlement.

## 35 Enheter och dynamiska förmågor

`assets` innehåller `id`, `tenant_id`, `site_id`, `customer_id`, `asset_type`, `manufacturer`, `model`, `serial_number`, `external_id`, `rated_power_kw`, `status`, `commissioned_at`, `decommissioned_at`, `created_at`, `updated_at`.

`asset_type` kan vara `ev`, `evse`, `battery`, `solar_inverter`, `meter`, `heat_pump`, `hems`, `hvac`, `industrial_load`, `generator`, `other_der` eller `other_flexible_load`. Elbil är första resursen, men modellen ska inte begränsas till bilar.

`asset_capabilities` innehåller `id`, `tenant_id`, `asset_id`, `capability`, `min_value`, `max_value`, `unit`, `metadata_json`, `source`, `verified_at`.

Exempel på förmågor är `read_soc`, `start_charge`, `stop_charge`, `set_power_limit`, `set_current_limit`, `schedule_charge`, `read_power`, `read_energy`, `battery_charge`, `battery_discharge`, `export_to_grid`, `solar_read`, `v1g`, `v2g`, `v2h`.

Operationella egenskaper ska stödja:

- Effekt och batteri: `max_import_kw`, `max_export_kw`, `current_power_kw`, `min_soc`, `max_soc`, `current_soc`, `battery_capacity_kwh`, `charge_efficiency`, `discharge_efficiency`.
- Respons: `response_latency_ms`, `ramp_rate_kw_s`.
- Tid och kundmål: `availability_from`, `availability_until`, `required_departure_time`, `required_departure_soc`.
- Produkter: `supports_fcr_n`, `supports_fcr_d_up`, `supports_fcr_d_down`, `supports_afrr_up`, `supports_afrr_down`, `supports_mfrr_up`, `supports_mfrr_down`.

Förmågor är dynamiska och måste bygga på verkliga observationer eller verifiering. Två enheter med samma modellnamn får inte automatiskt antas ha samma åtkomst eller funktion.

## 36 Flexexa Connect

Flexexa Connect ska vara en egen kanonisk anslutningsplattform. Den ska stödja både egna direkta integrationer och Enode som en utbytbar adapter. Andra tjänster använder Flexexas gemensamma enhets-API och ska inte anropa Enode, Tesla eller OCPP direkt.

Gemensamma gränssnitt är `VehicleProvider`, `ChargerProvider`, `BatteryProvider`, `SolarProvider`, `MeterProvider` och `HVACProvider`.

Varje provider ska implementera `authenticate()`, `refreshAuthentication()`, `discoverAssets()`, `getAsset()`, `getState()`, `getCapabilities()`, `executeCommand()`, `subscribeWebhooks()`, `handleWebhook()`, `normalizeState()`, `healthCheck()`.

`integration_providers` innehåller `id`, `key`, `name`, `provider_type`, `status`, `supports_oauth`, `supports_webhook`, `supports_polling`, `rate_limit_config_json`, `capabilities_json`, `created_at`, `updated_at`.

Initiala integrationer och roadmap omfattar `ocpp`, `enode`, `tesla`, `volvo`, `bmw`, `mercedes`, `vw`, `polestar`, `kia`, `hyundai`, `solaredge`, `sunspec`, `eltariff`, `elprisetjustnu`, `nordpool`, `smhi`, `bsp_partner` och `dso_market`.

`provider_accounts` innehåller `id`, `tenant_id`, `provider_id`, `external_account_id`, `credential_reference`, `connection_status`, `token_expires_at`, `last_success_at`, `last_error_at`, `created_at`, `updated_at`. Hemligheterna lagras inte i denna tabell.

`asset_connections` innehåller `id`, `tenant_id`, `asset_id`, `provider_account_id`, `external_asset_id`, `connection_type`, `status`, `priority`, `capabilities_json`, `last_sync_at`, `last_seen_at`, `valid_from`, `valid_until`.

En enhet kan ha flera observationsvägar. Prioritet och hälsa avgör vilken giltig leverantörsväg som används. Den separata V1.1-bilagan förtydligar hur vi ska bevisa fysisk identitet, en enda aktiv skrivauktoritet och säker överlämning mellan styrvägar.

## 37 Kanoniska enhetstillstånd

| Enhet | Gemensamma tillståndsfält |
| --- | --- |
| Elbil | `soc_percent`, `charge_limit_percent`, `plugged_in`, `charging_state`, `estimated_range_km`, `battery_capacity_kwh`, `charge_power_kw`, `location`, `updated_at` |
| Laddare | `online`, `connector_status`, `transaction_active`, `current_a`, `power_kw`, `energy_kwh`, `max_power_kw`, `max_current_a`, `phase_count`, `updated_at` |
| Batteri | `soc_percent`, `charge_power_kw`, `discharge_power_kw`, `capacity_kwh`, `available_charge_kw`, `available_discharge_kw`, `operating_mode` |
| Sol | `generation_kw`, `energy_today_kwh`, `export_kw` |
| Elmätare | `import_power_kw`, `export_power_kw`, `import_energy_kwh`, `export_energy_kwh`, `phase_1_current_a`, `phase_2_current_a`, `phase_3_current_a`, `voltage_l1`, `voltage_l2`, `voltage_l3`, `timestamp`, `quality` |

Mätning kan komma från HAN/P1, Modbus, laddare eller lastbalanserare och senare från nätägares moln, elhandelsdata eller godkänd tredje part. Alla källor ska normaliseras och ha spårbarhet.

## 38 OCPP CitrineOS och Edge

Plattformen ska stödja OCPP 1.6J och OCPP 2.0.1 samt vara förberedd för OCPP 2.1. Den faktiska kompatibiliteten måste verifieras för berörd implementation och enhet.

CitrineOS körs som ett avgränsat CSMS och ansvarar för OCPP-WebSockets, protokollscheman, meddelanden, laddaranslutning, transaktioner, mätmeddelanden och OCPP-kommandon.

Flexexa ansvarar för kunder, enheter, tariffer, optimering, policyer, flexibilitet, dispatch, settlement och kundbelöningar.

Framtida Flexexa Edge bygger på EVerest och ska kunna hantera lokala scheman, offlineplan, lastbalansering, säkringsgränser, laddström, paus och återstart, lokal reservstrategi, kommandovalidering, enhetshälsa samt cachad policy och laddplan. Arkitekturen ska medge utveckling mot ISO 15118, IEC 61851 och V2G.

Molnet får aldrig åsidosätta kabelns, laddarens eller säkringens märkgränser, fasbegränsningar, lokal säkerhet eller bilens begränsningar. Ingen språkmodell används i realtidsstyrningen.

## 39 Önskat tillstånd rapporterat tillstånd och kommandon

`asset_shadows` innehåller `tenant_id`, `asset_id`, `reported_state_json`, `desired_state_json`, `reported_at`, `desired_at`, `state_version`, `last_command_id`, `updated_at`.

Önskat tillstånd får inte kopieras till rapporterat tillstånd bara för att ett kommando skickats. Den rapporterade bilden ska bygga på enhetens faktiska observationer.

`asset_commands` innehåller `id`, `tenant_id`, `asset_id`, `command_type`, `requested_payload_json`, `reason`, `requested_by_type`, `requested_by_id`, `correlation_id`, `idempotency_key`, `requested_at`, `expires_at`, `status`, `provider_id`, `sent_at`, `acknowledged_at`, `completed_at`, `failed_at`, `failure_code`, `failure_message`.

Kommandoskäl är `customer_manual`, `price_optimization`, `grid_tariff`, `load_balancing`, `flex_activation`, `emergency` och `system_recovery`.

Basprioriteten är elsäkerhet, nödläge eller lokalt skydd, uttrycklig kundöverstyrning, mobilitetsgaranti, befintligt flexibilitetsåtagande, platsbegränsningar, tariffoptimering och spotoptimering.

Prioritet är versionsstyrd genom regelmotorn. Platsens hårda elektriska gränser omfattas alltid av den överordnade fysiska säkerheten även om operativa platsönskemål ligger längre ned i prioriteringen.

## 40 Elpriser

Första prisleverantören är Elprisetjustnu med provideridentiteten `elprisetjustnu`. Plattformen ska hämta SE1, SE2, SE3 och SE4 och stödja tillgängliga intervall på 15 minuter.

Prislogiken ska använda gränssnittet `PriceProvider`, först genom `ElprisetJustNuProvider` och senare genom `NordPoolPriceProvider`.

`price_sources` innehåller `id`, `provider`, `market_area_id`, `priority`, `currency`, `unit`, `resolution_minutes`, `status`, `valid_from`, `valid_until`.

`electricity_prices` innehåller `id`, `source_id`, `market_area_id`, `starts_at`, `ends_at`, `resolution_minutes`, `price`, `currency`, `unit`, `quality`, `published_at`, `ingested_at`. Kombinationen `source_id + market_area_id + starts_at` ska vara unik.

Spårbarheten ska ange `provider`, `retrieved_at`, `published_at`, `quality`, `is_final`, `fallback_used` och `original_payload_hash`.

Optimeraren får inte tyst använda gamla eller saknade priser. Senare blir Nord Pool primär källa när rätt kommersiell licens finns. Elprisetjustnu kan då vara reserv, jämförelse eller utvecklingskälla. ENTSO-E och andra källor används bara när användningsrätt och teknisk lämplighet är verifierade.

## 41 Elområden

`market_areas` innehåller `id`, `country_code`, `code`, `name`, `timezone`, `currency`, `valid_from`, `valid_until`.

Första områdena är SE1, SE2, SE3 och SE4. Fler länder och områden ska kunna införas genom country packs utan att ändra den gemensamma datamodellen.

## 42 Nättariffer elhandelsvillkor och skatt

Tariffintegrationer ska gå genom `GridTariffProvider`. Källor är RISE Eltariff, Sourceful där det är lämpligt, direkta nätägar-API:er och manuellt registrerade versionsstyrda tariffer.

`grid_tariffs` innehåller `id`, `dso_actor_id`, `external_tariff_id`, `name`, `product_code`, `customer_segment`, `fuse_min`, `fuse_max`, `valid_from`, `valid_until`, `timezone`, `source`, `source_version`, `status`, `created_at`, `updated_at`.

`grid_tariff_components` innehåller `id`, `grid_tariff_id`, `component_type`, `price`, `currency`, `unit`, `vat_included`, `valid_from`, `valid_until`, `start_time`, `end_time`, `weekdays_json`, `months_json`, `calculation_method`, `aggregation_period_minutes`, `peak_count`, `metadata_json`.

Komponenttyper är `fixed`, `energy`, `power`, `peak`, `time_of_use`, `seasonal`, `reactive` och `other`. Tidsfönster, veckodagar, månader, toppantal och aggregeringsperiod ska vara data i stället för antaganden i optimeraren.

`site_tariff_assignments` innehåller `id`, `tenant_id`, `site_id`, `grid_tariff_id`, `valid_from`, `valid_until`, `source`, `verified_at`.

Motsvarande struktur ska finnas för `retailer_tariffs`, `retailer_tariff_components` och `site_retailer_tariff_assignments`. Den ska stödja påslag, fast månadsavgift, dynamiskt pris, kundrabatt, EV-bonus och laddincitament.

`tax_rules` innehåller `id`, `country_code`, `region`, `tax_type`, `value`, `unit`, `valid_from`, `valid_until`, `conditions_json`.

Tariffer och skatter är versionsstyrda data och regler. För en historisk beräkning används de villkor som gällde då.

## 43 Beräkning av verklig kostnad

`true-cost-service` ska ta emot plats (`site`), intervall (`interval`), energi i kWh (`energy_kwh`), effekt i kW (`power_kw`), spotpris (`spot`), elhandelstariff, nättariff, skatt (`tax`), solproduktion (`solar`) och aktuell effekttoppsstatus för månaden.

Beräkningen ska redovisa `energy_market_cost`, `retailer_cost`, `grid_energy_cost`, `grid_power_cost_increment`, `tax_cost`, `vat`, `estimated_total_cost` och `marginal_cost`.

Optimeringen ska väga samman spotpris, elhandelspåslag, energiskatt, moms, överföringsavgift, tidsberoende tariff, effekt- eller toppavgift, beräknad förändring av effekttopp och övriga tariffkomponenter. Solvärde och relevant flexvärde påverkar jämförelsen.

Skillnaden mellan fast avgift och marginalkostnad måste bevaras. Det som gör en viss laddtimme dyrare är inte alltid samma sak som hela kundens månadsfaktura. Beräknat flexvärde ska förbli skilt från faktisk avräknad marknadsintäkt.

## 44 Kundens laddpreferenser

`charging_preferences` innehåller `id`, `tenant_id`, `customer_id`, `site_id`, `asset_id`, `enabled`, `departure_time_local`, `target_soc_percent`, `minimum_soc_percent`, `minimum_energy_kwh`, `priority_mode`, `allow_flex`, `allow_remote_pause`, `minimum_emergency_soc`, `max_charge_power_kw`, `valid_from`, `valid_until`, `updated_at`.

Tillåtna prioriteringslägen är `lowest_total_cost`, `balanced`, `fastest`, `solar_first`, `flex_first` och `manual`.

Preferenserna ska göra det tydligt vad kunden behöver före avresa, vilken lägsta laddnivå som ska behållas och om fjärrpaus eller flexibilitet är tillåten. De ersätter inte samtyckeskontrollen eller de fysiska gränserna.

## 45 Matematisk laddoptimering

Optimeraren ska vara en separat Python-tjänst och använda LP eller MILP med HiGHS och vid lämpliga problem OR-Tools. En språkmodell ska inte skapa eller verkställa laddplanen.

Målet är att minimera energikostnad, elhandelskostnad, nättariff, ökad effekttopp, batterislitage och kundolägenhet, med hänsyn till solvärde och förväntat flexvärde.

Begränsningarna är kundens mål-SOC före avresa, minsta SOC, laddarens och bilens effekt, platsens säkring och faser, batteribegränsningar, befintliga flexåtaganden, lokala säkerhetsgränser samt resursens tillgänglighet och förmåga.

`optimization_runs` innehåller `id`, `tenant_id`, `site_id`, `reason`, `requested_at`, `started_at`, `completed_at`, `input_snapshot_json`, `optimizer_version`, `policy_version`, `status`, `objective_value`, `failure_code`.

`charging_plans` innehåller `id`, `tenant_id`, `optimization_run_id`, `site_id`, `asset_id`, `valid_from`, `valid_until`, `status`, `required_energy_kwh`, `target_soc_percent`, `departure_at`, `estimated_cost`, `baseline_cost`, `estimated_savings`, `created_at`, `activated_at`.

`charging_plan_intervals` innehåller `id`, `tenant_id`, `charging_plan_id`, `starts_at`, `ends_at`, `target_power_kw`, `max_current_a`, `mode`, `expected_energy_kwh`, `expected_cost`, `flex_reserved_kw`.

En ny beräkning ska kunna triggas av anslutning eller urkoppling, väsentlig SOC-förändring, ändrad avresetid, nya priser, ändrad tariff, ändrad hushållslast, nytt flexåtagande, dispatch, ny solprognos, kommandofel, leverantörsfel, frånkopplad enhet samt kundöverstyrning eller nödläge.

Den överenskomna testningen ska bevisa att både planens indata och den faktiskt utförda laddningen motsvarar kundmålet. Ett matematiskt optimalt svar är inte bevis för att en laddare har följt planen.

## 46 Väder prognoser sol och batteri

SMHI Open Data är den planerade väderkällan. Väder används för solprognos, lastprognos och prognos för värmepumpar.

Första prognoserna ska använda historisk förbrukning, veckodag, klockslag, temperatur, väder, tidigare laddning, SOC, avresebeteende, spotpris och historisk flexibilitet.

Prognosobjekt är `household_load`, `solar_generation`, `plug_in_probability`, `departure_probability`, `ev_energy_requirement` och `available_flexibility`.

Kapacitetsbedömningen ska kunna redovisa P50, P80, P90 och P95. Marknadsmotorn kan använda konservativ kapacitet enligt tillämplig modell. V1.1-tillägget kräver att statistisk kalibrering bevisas innan en sådan nivå beskrivs som kalibrerad säkerhet.

Börja med enkla metoder och samla versionsbestämda data för senare ML. Sol och batteri ansluts initialt via tillgänglig Enode-förmåga, senare via direkta OEM-adaptrar, SunSpec, Modbus TCP och på sikt EEBUS.

## 47 Flexibilitetsmotor

Motorn ska löpande beräkna `available_up_kw`, `available_down_kw`, `safe_up_kw`, `safe_down_kw`, `confidence_score`, `available_duration` och `energy_headroom`.

Resultatet ska respektera SOC, avresekrav, laddgränser, kundpreferenser, befintliga åtaganden, enhets- och leverantörshälsa, datans ålder och säkerhetsregler.

Varje fysisk resurs ska kunna spåras genom plats, mätpunkt, elområde, DSO, elhandlare, BRP, BSP, portfölj, produkt, åtagande, dispatch, mätning och settlement.

Riktning och tecken ska definieras enligt produkt och mätgräns. För V1G är minskad förbrukning en lastförändring; den ska inte registreras som exporterad el från bilen.

## 48 Flexmarknader och produkter

`flex_market_providers` innehåller `id`, `name`, `provider_type`, `country_code`, `api_type`, `status`, `configuration_json`, `valid_from`, `valid_until`.

Leverantörstypen kan vara `bsp`, `tso`, `dso`, `flex_marketplace`, `bilateral` eller `internal`.

`flex_products` innehåller `id`, `provider_id`, `external_product_id`, `name`, `product_type`, `direction`, `minimum_power_kw`, `minimum_duration_seconds`, `response_time_seconds`, `delivery_resolution_seconds`, `availability_payment_supported`, `activation_payment_supported`, `location_constraint_type`, `prequalification_required`, `rules_json`, `valid_from`, `valid_until`.

Produktkatalogen ska kunna beskriva `fcr_n`, `fcr_d_up`, `fcr_d_down`, `afrr_up`, `afrr_down`, `mfrr_up`, `mfrr_down`, `local_capacity`, `local_activation`, `ffr` där det är relevant, `congestion`, `bilateral`, `internal_portfolio` och `future_market`.

Att en produkt finns i katalogen betyder inte att våra resurser är godkända för den. Krav som minsta budstorlek, responstid och mätning ska komma från en verifierad och versionsbestämd källa, inte från hårdkodade antaganden.

## 49 Förkvalificering och deltagandebehörighet

`flex_prequalifications` innehåller `id`, `tenant_id`, `asset_id`, `portfolio_id`, `product_id`, `qualification_status`, `approved_up_kw`, `approved_down_kw`, `direction`, `measurement_method`, `baseline_method`, `test_results_json`, `document_reference`, `valid_from`, `valid_until`, `verified_at`, `created_at`, `updated_at`.

Tre bedömningar ska hållas isär: `technically_available`, `market_eligible` och `commercially_available`.

Behörighetskontrollen ska omfatta online- och styrstatus, kundsamtycke, rätt BSP, BRP, DSO, elområde och geografi, elhandlar- eller partneravtal, konfliktfria åtaganden, SOC och tidsmarginal före avresa, mätkvalitet, förkvalificering, responsförmåga samt enhets- och leverantörshälsa.

Bedömning och beräkningsversion ska sparas. En onlinebil med ledigt batteri är inte automatiskt en kommersiellt säljbar marknadsresurs.

## 50 Portföljer och poolbildning

`flex_portfolios` innehåller `id`, `tenant_id`, `name`, `market_provider_id`, `flex_product_id`, `market_area_id`, `bsp_actor_id`, `brp_actor_id`, `currency`, `status`, `valid_from`, `valid_until`.

`flex_portfolio_memberships` innehåller `id`, `tenant_id`, `portfolio_id`, `asset_id`, `site_id`, `valid_from`, `valid_until`, `max_up_kw`, `max_down_kw`, `prequalified`, `eligibility_status`, `eligibility_reason`, `created_at`.

Poolbildningen ska filtrera resurser genom behörighet, tillgänglighet, risk, geografi, rätt BRP/BSP och rätt marknadsprodukt. Reservmarginal används alltid.

Basplanens illustrativa exempel är nominellt 2,4 MW, säkert 1,8 MW, bud 1,5 MW och reserv 0,3 MW. Det är ett räkneexempel, inte en fast marginal för alla produkter. Hundra procent av en naivt summerad enhetskapacitet får inte bjudas ut.

## 51 Tillgänglighet och reservationer

`flex_availability_snapshots` innehåller `id`, `tenant_id`, `asset_id`, `portfolio_id`, `timestamp`, `available_up_kw`, `available_down_kw`, `available_energy_up_kwh`, `available_energy_down_kwh`, `earliest_start`, `latest_end`, `confidence`, `reason_json`, `calculation_version`.

`flex_reservations` innehåller `id`, `tenant_id`, `asset_id`, `portfolio_id`, `commitment_id`, `starts_at`, `ends_at`, `reserved_up_kw`, `reserved_down_kw`, `priority`, `status`, `created_at`.

Kvarvarande kapacitet är fysisk tillgänglighet minus överlappande befintliga reservationer. Skrivningen ska vara atomisk även när flera anrop sker samtidigt, med nödvändiga radlås eller rådgivande lås.

Det ska vara omöjligt att sälja samma fysiska kapacitet två gånger. V1.1-tillägget förtydligar att flera observationsvägar, gemensam platskapacitet, energi och återhämtningslast också ska ingå i beviset.

## 52 Flexmöjligheter och marknadsoptimering

`flex_opportunities` innehåller `id`, `provider_id`, `product_id`, `market_area_id`, `starts_at`, `ends_at`, `direction`, `requested_power_kw`, `capacity_price`, `activation_price`, `currency`, `location_constraint_json`, `source_payload_reference`, `status`.

Marknadsoptimeraren jämför riskjusterat värde för smart laddning, FCR, aFRR, mFRR, lokal nätflex, intern portföljoptimering och bilateral flexibilitet.

Senare får samma resurs bidra till flera förenliga produkter bara när reglerna uttryckligen medger det och åtaganderegistret kan bevisa att kapacitet och ersättning inte dubbelräknas.

## 53 Marknadsåtaganden och dispatch

`flex_commitments` innehåller `id`, `tenant_id`, `portfolio_id`, `external_bid_id`, `external_commitment_id`, `product_id`, `starts_at`, `ends_at`, `direction`, `committed_power_kw`, `capacity_price`, `status`, `submitted_at`, `accepted_at`, `rejected_at`, `source`, `policy_set_version_id`, `eligibility_evaluation_id`.

`flex_dispatches` innehåller `id`, `tenant_id`, `commitment_id`, `external_dispatch_id`, `requested_at`, `starts_at`, `ends_at`, `direction`, `requested_power_kw`, `status`, `received_at`, `acknowledged_at`, `completed_at`.

`flex_dispatch_allocations` innehåller `id`, `tenant_id`, `dispatch_id`, `asset_id`, `target_delta_kw`, `baseline_power_kw`, `target_power_kw`, `command_id`, `status`, `started_at`, `completed_at`.

BSP skickar en aktivering för poolen. Flexexa väljer enheterna utifrån SOC, kundens mobilitet, laddgränser, anslutning, svarstid, hälsa, tidigare aktiveringar, rättvis fördelning, batterislitage och reservkapacitet.

Enheterna som används vid verklig dispatch får skilja sig från dem som ingick i prognosen, så länge det verifierade åtagandet, reglerna och kapacitetsgränserna fortfarande uppfylls.

## 54 Omfördelning och reservvägar vid styrfel

En aktivering ska kunna hantera kommandotimeout, enhetskvittens, utförandetillstånd, mätbekräftelse, säker alternativ styrväg och automatisk omfördelning till reservresurser.

Basplanens illustrativa exempel är aktivering 500 kW, beordrad effekt 520 kW, bortfall 40 kW, omfördelning ytterligare 40 kW och verkligt uppmätt resultat 503 kW. Dessa tal är inte generella toleranser eller produktkrav.

Reservvägen får inte skapa konkurrerande kontroll eller återanvända kapacitet som redan är upptagen. Styrsystemet fungerar separat från Next.js och frontend. `control.flexexa.internal` är ett internt endpointkoncept, inte ett bevis för en driftsatt adress.

## 55 Gemensamt BSP-gränssnitt

`BspProvider` ska kunna beskriva den samlade förmåga som olika partners behöver:

- Produkt och registrering: `getProducts()`, `getPortfolioRequirements()`, `registerResource()`, `updateResource()`.
- Tillgänglighet och kapacitet: `submitAvailability()`, `withdrawAvailability()`, `submitCapacity()`, `updateCapacity()`.
- Bud: `submitBid()`, `updateBid()`, `cancelBid()`.
- Aktivering och dispatch: `receiveActivation()`, `receiveDispatch()`, `acknowledgeActivation()`, `acknowledgeDispatch()`.
- Telemetri och leverans: `sendTelemetry()`, `submitDeliveredEnergy()`.
- Resultat och ekonomi: `getMarketResult()`, `getMarketResults()`, `getSettlement()`, `getSettlementStatements()`.
- Incident: `reportIncident()`.

Adaptrar ska kunna vara `PartnerAAdapter`, `PartnerBAdapter`, `PartnerCAdapter`, `MockBspAdapter` och `FlexexaDirectBspAdapter`. Detta är adapterroller, inte påståenden om redan avtalade partners.

Marknadsmotorn ska använda det gemensamma kontraktet. Det betyder inte att varje partner måste stödja alla metoder; den aktuella adapterns förmågor och avtal måste vara uttryckliga.

## 56 BSP-transporter och partner-API

Adapterlagret ska kunna hantera REST/JSON, webhooks, WebSocket, MQTT, AMQP, SFTP, CSV, Excel, XML, CIM XML, EDIFACT och befintliga fil- eller e-postflöden när en partner kräver det. ECP tillkommer senare.

Moderna integrationer bör använda REST och webhooks med OAuth2 `client_credentials`, mTLS när det är relevant, signerade payloads, tidsstämplar, nonce, skydd mot replay, idempotens, anropsgränser och schemavalidering.

Basplanen anger interna kanoniska endpointkoncept:

- `POST /bsp/v1/availability`
- `POST /bsp/v1/commitments`
- `POST /v1/activations`
- `POST /bsp/v1/deliveries`

Dessa är Flexexas designkontrakt. De ska inte beskrivas som en existerande Bixia- eller annan partner-API utan partnerns bekräftade specifikation.

BSP ska normalt få pool, marknad, kapacitet, tillgänglighet, leverans, mätidentifierare och settlementidentifierare. Kundnamn, VIN, GPS, onödiga personuppgifter och onödig råtelemetri ska inte följa med automatiskt.

Flexexa behåller kund- och enhetsstyrningen. Partneråtkomst är begränsad till avtalat och auktoriserat omfång.

## 57 BSP-sandbox

`MockBspAdapter` byggs tidigt för att testa hela det interna BSP-flödet utan kommersiellt marknadstillträde.

Simulatorn ska hantera accepterat bud, avvisat bud, delvis accepterat bud, aktivering, delaktivering, dubblettaktivering, timeout, nätverksavbrott, felaktigt meddelande, försenat marknadsresultat, settlement, sanktion och rättelse.

Simulatorn ska använda de verkliga kanoniska hanterarna. Ett lyckat mockflöde innebär inte att en partner har godkänt integrationen.

## 58 Beredskap för direkt BSP-anslutning

Marknadsmotorn ska senare kunna använda Flexexa BSP Gateway med CIM-kodare och avkodare, ECP-klient, Nordic MMS-adapter, EDIFACT där det krävs och en motor för marknadskvittenser.

Direkt marknadsintegration får aktiveras först när rätt BSP-roll, avtal, förkvalificering, teknisk certifiering, certifikat, säkerhetskrav och övriga marknadskrav är uppfyllda.

Basplanens gräns kvarstår: Flexexa ska inte bli BRP. Den framtida direkta modellen får bara användas om den är förenlig med den då gällande och verifierade aktörsmodellen.


## 59 BRP-påverkan och kompensation

En särskild BRP-domän ska beräkna hur en flexibilitetsleverans förändrar energin jämfört med relevant baslinje och vilken kompensation eller justering som gäller enligt verifierad regel och avtal.

`brp_impact_calculations` innehåller `id`, `tenant_id`, `dispatch_id`, `asset_id`, `site_id`, `metering_point_id`, `brp_actor_id`, `retailer_actor_id`, `baseline_energy_kwh`, `actual_energy_kwh`, `flex_delta_kwh`, `imbalance_adjustment_kwh`, `compensation_amount`, `currency`, `calculation_method`, `calculation_version`, `status`, `created_at`.

Reglerna ska vara versionsstyrda. Flexibilitet över flera BRP-portföljer får bara användas när den gällande marknadsmodellen tillåter det och varje bidrag fortfarande kan hänföras till rätt aktör.

## 60 Kombinationer över elhandlare BSP och nätägare

Flexibilitet över flera elhandlare kräver samtycke, avtal och verifierade BRP-, BSP-, DSO- och marknadskombinationer. Ersättningen ska återföras till den faktiska enhetens, platsens, kundens och elhandlarens bidrag.

Enheter från olika BSP:er får inte automatiskt blandas i samma marknadsportfölj. `flex_portfolios.bsp_actor_id` ska vara uttryckligt. Eventuella framtida undantag ska vara verifierad konfiguration och får inte vara dolda specialfall i kod.

Lokala nätprodukter måste delas efter rätt geografiskt område och nätområde. Mätpunkt, DSO, nätområdeskod och geografiska produktbegränsningar ingår i kontrollen.

## 61 Mätning baslinje och leveransverifiering

`flex_delivery_measurements` innehåller `id`, `tenant_id`, `dispatch_id`, `asset_id`, `interval_start`, `interval_end`, `baseline_kw`, `actual_kw`, `delivered_up_kw`, `delivered_down_kw`, `energy_delta_kwh`, `measurement_source`, `quality`, `method_version`.

Redovisningen per enhet ska kunna beskriva `requested_power`, `delivered_power`, `duration`, `availability`, `response_time`, `quality`, `baseline`, `actual_consumption`, `counterfactual_consumption`, `delivered_flexibility`, `revenue`, `penalty`, `customer_share`, `flexexa_share`, `bsp_share` och `retailer_share`.

Baslinjemetod, policy, regelversion, optimeringsversion och övriga betydande beräkningsversioner ska följa med marknadshändelsen. Begärd effekt, kvitterad effekt, uppmätt effekt, verifierad leverans och externt avräknad mängd är skilda storheter.

Saknade mätdata får inte ersättas med den effekt vi önskade leverera. Rättelser ska behålla spårbarheten till tidigare underlag och beräkningsversion.

## 62 Settlementkällor och importadaptrar

`SettlementProviderAdapter` ska stödja avräkning från BSP, DSO, lokal flexibilitetsmarknad, marknadsplats, senare direkt TSO och bilaterala partners.

Import kan ske via REST, webhook, CSV, Excel, JSON, SFTP, XML, EDIFACT eller produktspecifika filer. Varje adapter normaliserar till samma interna settlementmodell.

`settlement_statements` innehåller `id`, `tenant_id` där tenantägande gäller, `provider_id`, `external_statement_id`, `period_start`, `period_end`, `currency`, `gross_amount`, `status`, `received_at`, `source_file_reference`, `source_hash`, `created_at`.

Kombinationen `provider_id + external_statement_id` ska vara unik. Ägandet på varje statement och rad måste vara tydligt även när en extern fil omfattar fler än en tenant; vanliga tenantvägar får inte exponera andras underlag.

`settlement_statement_lines` innehåller `id`, `statement_id`, `external_line_id`, `commitment_id`, `dispatch_id`, `portfolio_id`, `product_id`, `market_area_id`, `payment_type`, `quantity`, `quantity_unit`, `unit_price`, `amount`, `currency`, `starts_at`, `ends_at`, `metadata_json`.

Betalningstyper är `capacity`, `availability`, `activation`, `energy`, `bonus`, `penalty`, `adjustment` och `fee`.

## 63 Avtalsstyrd intäktsfördelning

Ekonomin ska fördelas per bidragande enhet och plats, inte bara som ett totalbelopp per tenant.

Varje extern avräkningsrad ska kunna följas till portfölj, dispatch, verifierat fysiskt bidrag, enhet, plats och relevant kund, elhandlare, OEM, BSP eller Flexexa.

Motorn ska stödja BSP-avgift, Flexexa-avgift, BRP-kompensation, nätjusteringar, sanktioner, elhandlarandel, OEM- eller enhetsägarandel och kundbelöning.

`revenue_share_agreements` innehåller `id`, `tenant_id`, `counterparty_actor_id`, `scope_type`, `scope_id`, `calculation_type`, `customer_share`, `retailer_share`, `oem_share`, `bsp_share`, `flexexa_share`, `configuration_json`, `valid_from`, `valid_until`, `version`, `status`.

Beräkningstypen kan vara `percentage`, `fixed_per_kw`, `fixed_per_kwh`, `fixed_per_asset`, `tiered` eller `custom`.

Ingen intäktsprocent ska hårdkodas för alla partners. Beräkningsbas, avdrag, ordning, gränser och giltighet måste följa rätt avtal och rätt version.

## 64 Ekonomisk huvudbok

`ledger_accounts` innehåller `id`, `owner_type`, `owner_id`, `account_type`, `currency`, `status`.

`ledger_transactions` innehåller `id`, `transaction_type`, `reference_type`, `reference_id`, `occurred_at`, `description`, `status`.

`ledger_entries` innehåller `id`, `transaction_id`, `account_id`, `direction`, `amount`, `currency`, `metadata_json`.

Varje transaktion måste ha lika mycket debet som kredit. En obalanserad transaktion får inte commitas.

Tenantägda ekonomiska objekt omfattas även av de gemensamma tenantkraven i avsnitt 5 och 6. Den korta fältlistan här är inte ett undantag som tillåter oskyddad tenantdata.

Stripe får inte användas som huvudbok för energi eller flexibilitet. Stripe kan senare användas för SaaS-abonnemang.

`customer_reward_entries` innehåller `id`, `tenant_id`, `customer_id`, `site_id`, `asset_id`, `settlement_line_id`, `reward_type`, `amount`, `currency`, `period_start`, `period_end`, `status`, `ledger_transaction_id`, `created_at`.

Smart laddbesparing, nätavgiftsbesparing, solbesparing och flexbelöning redovisas separat. En beräknad besparing är inte marknadsintäkt eller ett belopp som motparten har betalat.

## 65 Avstämning av settlement

Avstämningen jämför `expected_market_revenue`, `actual_market_statement` och `difference`.

Statusar är `unmatched`, `matched`, `partially_matched`, `disputed`, `adjusted` och `closed`.

Systemet ska hitta saknad dispatch, fel mängd, prisskillnad, saknade enheter, avvikande BSP-avgift, fel DSO, dubblettstatement och fel valuta.

Om historiska data räknas om ska det uttryckligen registreras att en ny beräkningsversion användes. Dagens regelversion får inte tyst skriva om resultatet av en gammal händelse.

## 66 Samtycken och kundöverstyrning

`consents` innehåller `id`, `tenant_id`, `customer_id`, `site_id`, `asset_id`, `consent_type`, `status`, `policy_version`, `granted_at`, `revoked_at`, `source`, `evidence_json`.

Separata samtycken krävs för smart laddning, fjärrstyrning, flexibilitetsdeltagande, datadelning, fordons-API, platsinformation där det behövs och marknadsdeltagande.

När kunden väljer Ladda nu ska systemet registrera överstyrningen i audit, frigöra eller hantera berörd flexkapacitet enligt åtagandets regler, räkna om planen, respektera elsäkerheten och uppdatera marknadstillgängligheten.

V1.1-tillägget förtydligar att återkallat samtycke också måste stoppa ett ännu inte skickat kommando som väntar i en kö. Ett påverkat åtagande ska hanteras öppet som avvikelse, inte döljas som lyckad leverans.

## 67 Externt kund- och partner-API

API-domänen är planerad som `https://api.flexexa.com` och första versionens prefix är `/v1`. När en sökväg nedan börjar med `/v1` ska prefixet inte läggas till en gång till.

| Område | Sökvägar |
| --- | --- |
| Kund och plats | `/v1/customers`, `/v1/sites`, `/v1/metering-points` |
| Enheter | `/v1/assets`, `/v1/assets/{id}`, `/v1/assets/{id}/state`, `/v1/assets/{id}/capabilities`, `/v1/assets/{id}/commands` |
| Kostnad | `/v1/prices`, `/v1/tariffs`, `/v1/true-cost` |
| Laddning | `/v1/charging/preferences`, `/v1/charging/plans`, `/v1/optimization/runs` |
| Flexibilitet | `/v1/flex/portfolios`, `/v1/flex/availability`, `/v1/flex/commitments`, `/v1/flex/dispatches` |
| Ekonomisk vy | `/v1/settlements`, `/v1/rewards`, `/v1/savings` |

API ska ha stabila ID:n, OpenAPI, versionshantering, paginering, cursorpaginering för stora mängder, filtrering, request-ID:n, idempotens och anropsgränser.

Brytande ändringar förs till `/v2`. Dessa adresser beskriver målet för API-kontraktet och bevisar inte att varje route redan finns i drift.

## 68 API-autentisering webhooks och SDK

B2B ska stödja OAuth2 client credentials. Känsliga partnerintegrationer ska använda mTLS där det behövs. En pilot kan använda begränsade API-nycklar.

API-nyckeln visas bara när den skapas. Databasen lagrar hash. Nyckeln ska ha omfång, giltighet, rotation, återkallelse och anropsgränser.

Webhookkatalogen ska minst innehålla `asset.connected`, `asset.disconnected`, `asset.state.updated`, `charging.started`, `charging.stopped`, `charging.plan.updated`, `optimization.completed`, `flex.available`, `flex.commitment.created`, `flex.dispatch.received`, `flex.dispatch.completed`, `settlement.completed` och `reward.created`.

Webhookkuvertet innehåller `event_id`, `event_type`, `event_version`, `created_at`, `tenant_id`, `data`.

Webhooks ska använda HMAC-signering, tidsstämpel, återförsök med exponentiell fördröjning, dead-letter och replay-skydd.

TypeScript-paketet `@flexexa/sdk` ska erbjuda `getVehicle()`, `getChargingPlan()`, `setDepartureTime()`, `setTargetSoc()`, `enableSmartCharging()`, `chargeNow()`, `getSavings()` och `getFlexRewards()`.

Senare tillkommer Swift, Kotlin och varumärkesanpassningsbara UI-komponenter. En partner med egen app ska kunna använda API och SDK utan att kunden måste byta till en Flexexa-app.

## 69 Gränssnitt och portaler

Next.js App Router på Vercel används för marknadssida, partnerportal, superadmin, utvecklarportal och kundwebb eller PWA. Native konsumentapp byggs senare med React Native och Expo som referens- eller white label-app.

Partnerdashboard ska visa anslutna enheter, online-laddare, aktiv laddning, optimerad energi, kundbesparing, tillgänglig och kontrakterad flexibilitet, levererad flexibilitet, flexintäkt, kundbelöningar och leverantörshälsa.

Kundadministration ska hantera kunder, platser, enheter, integrationer, tariffer, preferenser, samtycken, kommandon, fel och produktbehörighet.

Flexdashboard ska visa fysisk, prognostiserad och säker tillgänglighet, reserverad kapacitet, åtaganden, dispatch, leveransresultat, marknadsintäkter, sanktioner, settlement, avstämning och kundfördelning.

Superadmin ska ha stöd för organisationer, tenants, varumärken, länder, integrationer, leverantörer och hälsa, kunder och enheter, platser, tariffer, marknadsaktörer, BSP/BRP/DSO, portföljer, flexprodukter, förkvalificering, settlement, ledger, regler och policyer, feature flags, API-klienter, webhooks, audit och incidenter.

Kundens PWA ska visa smart laddning på eller av, bilstatus, mål-SOC, klart före-tid, uppskattad kostnad, uppskattad besparing, flexbelöning och Ladda nu. Kunden ska inte behöva förstå FCR, BSP, BRP eller tariffmotorns internals för att använda produkten.

Alla vyer ska använda samma auktoritativa data och beräkningar. En dashboard får inte ha en egen ekonomisk eller kapacitetsmodell.

## 70 Revisionsspår och datakällor

`audit_events` innehåller `id`, `tenant_id`, `actor_type`, `actor_id`, `action`, `resource_type`, `resource_id`, `occurred_at`, `ip`, `user_agent`, `correlation_id`, `metadata_json`.

Audit ska kunna exporteras oföränderligt till S3. Kritiska marknads- och styråtgärder lagrar dessutom vem, vad, när, källa, `payload_hash`, policybeslut och resultat.

Gemensamma källfält är `source_type`, `source_provider_id`, `source_external_id`, `source_timestamp`, `ingested_at`, `quality`, `schema_version`, `raw_payload_reference` och `raw_payload_hash`.

Plattformen ska skilja mellan ett leverantörsrapporterat faktum, ett av Flexexa beräknat faktum, en kundpreferens och ett marknadsbekräftat faktum.

## 71 Säkerhet

Säkerhetskraven omfattar TLS, mTLS där det är relevant, OAuth2/OIDC, strikt RLS, tenantisolering, begränsad IAM, Secrets Manager, KMS, WAF, anropsgränser samt validering av begäran och schema.

Utvecklings- och leveranskedjan ska ha beroende-, sårbarhets- och containerskanning, SBOM och signerade containerbilder där det är praktiskt möjligt.

Certifikat ska kunna roteras. Edge ska stödja signerade kommandon där hårdvaran medger det, signerad firmware och senare secure boot. TPM eller säker komponent används där hårdvaran stöder det.

Kritiska anrop kräver nonce, tidsstämpel, replay-skydd och idempotens. Högriskåtkomst ska kunna kräva förstärkt autentisering och nödsessioner ska granskas.

Hemligheter lagras inte i klartext i Postgres. Databasen får lagra `credential_reference`, `secret_arn`, `provider`, `version` och `status` som referensmetadata.

## 72 Övervakning leverantörshälsa och SLA

Använd OpenTelemetry, Prometheus-kompatibla mätvärden, Grafana, CloudWatch och Sentry eller likvärdig övervakning av applikationsfel.

Minimikatalogen av driftsmått är `connected_assets`, `ocpp_connections`, `command_latency`, `command_success_rate`, `telemetry_lag`, `optimization_latency`, `charging_deadline_success`, `flex_available_mw`, `flex_reserved_mw`, `flex_delivered_mw`, `flex_delivery_error`, `settlement_unmatched_amount`, `provider_error_rate` och `mobility_sla_success_rate`.

Leverantörshälsa ska redovisa `availability`, `latency`, `rate_limit_remaining`, `authentication_errors`, `webhook_lag`, `polling_lag`, `command_success_rate`, `last_success` och `last_error`.

Alternativ leverantörsväg får användas när det är säkert och auktoriserat. Det primära kundmåttet är att kundens begärda laddmål uppnås före begärd avresa. Flexibilitet får inte systematiskt försämra detta.

## 73 Avbrott offlinefunktion och återställning

Varje provider ska ha timeout, återförsök, exponentiell fördröjning, circuit breaker, anropsbegränsning, dead-letter, hälsotillstånd, manuell återställning och en definierad reservpolicy.

Om molnet försvinner ska enheten eller Edge kunna följa senaste fortfarande giltiga lokala plan. Om det inte längre är säkert att laddmålet uppnås ska en mobilitetssäker laddstrategi ta över inom elsäkerhetsgränserna.

Första återställningsmodellen använder primärregion `eu-north-1`, PITR, S3-versionering, reproducerbar infrastruktur, backuppolicy och verkliga återställningstester. Senare tillkommer en sekundär EU-region, varm reserv och återställning över regiongränser.

Att det finns en backup är inte samma sak som att en fungerande återställning är bevisad.

## 74 Register över datakällor och användningsrätt

`data_sources` innehåller `id`, `name`, `source_type`, `provider`, `license_type`, `commercial_use_status`, `redistribution_status`, `priority`, `status`, `documentation_reference`, `last_reviewed_at`.

För varje källa ska det framgå om data får användas internt, visas, lagras, vidareförmedlas och återanvändas kommersiellt.

| Datatyp | Planerade källor |
| --- | --- |
| Priser | Elprisetjustnu i V1; Nord Pool senare med rätt licens; ENTSO-E eller annan reserv bara där rättigheterna medger det. |
| Tariffer | RISE Eltariff, Sourceful, direkt DSO och manuella versionsstyrda tariffer. |
| Väder | SMHI. |
| Enheter | Direkt OCPP, Enode, OEM-API:er, SunSpec, HAN/P1 och senare EEBUS. |
| Marknad och flexibilitet | BSP-partner, DSO, lokal flex, Svenska kraftnäts publika data för analys där användningen är tillåten och senare direkt marknadsgränssnitt. |

Källistan är ett integrationsmål. Den ska inte tolkas som att alla leverantörer redan tillåter kommersiell distribution eller att alla anslutningar redan finns.


## 75 Komponenter med öppen källkod

| Komponent eller standard | Avsedd användning |
| --- | --- |
| CitrineOS | CSMS och OCPP-kommunikation. |
| EVerest | Framtida Edge och lokal laddarstack. |
| HiGHS och OR-Tools | Matematisk optimering. |
| RabbitMQ | Meddelandebuss. |
| Valkey | Distribuerad cache och lås. |
| PostgreSQL | Transaktionell databas. |
| ClickHouse | Telemetrianalys. |
| OpenTelemetry | Gemensamma traces och mätvärden. |
| Prometheus-kompatibla metrics och Grafana | Driftsmätning och visualisering. |
| OpenTofu | Infrastruktur som kod. |
| SunSpec och Modbus | Standardiserad enhetskommunikation där det är relevant. |
| OpenAPI AsyncAPI och JSON Schema | Gemensamma dokumenterade kontrakt. |
| Zod och Pydantic | Validering av TypeScript- och Python-modeller. |

Adaptrar ska hållas tunna. En djup egen fork ska bara göras när det är nödvändigt. För varje komponent ska upstreamprojekt, version, licens, lokala ändringar, uppdateringsstrategi och NOTICE eller attributionskrav dokumenteras.

## 76 Monorepo och kodorganisation

Använd pnpm och Turborepo. Följande är målstrukturen, inte ett påstående om att alla kataloger redan finns.

| Katalog | Innehåll |
| --- | --- |
| `apps/` | `marketing/`, `partner-portal/`, `admin/`, `developer-portal/`, `consumer-web/` |
| `services/` | De domäntjänster som beskrivs i avsnitt 28, inklusive API, identitet, tenant, enheter, anslutning, styrning, kostnad, optimering, marknad, mätning, settlement, regler, webhooks, notifiering och simulering. |
| `integrations/` | `ocpp/`, `citrineos/`, `enode/`, `tesla/`, `elprisetjustnu/`, `nordpool/`, `entsoe/`, `eltariff/`, `sourceful/`, `smhi/`, `sunspec/`, `bsp/`, `svk/`, `local-flex/` |
| `packages/` | `kernel/`, `domain/`, `database/`, `auth/`, `events/`, `api-contracts/`, `sdk/`, `ui-sdk/`, `observability/`, `security/`, `config/` |
| `country-packs/` | Först `se/`, därefter andra länder. |
| `supabase/` | `migrations/` och `tests/`. |
| `infra/` | `opentofu/`, `terraform-compatible/`, `docker/`, `monitoring/`. |
| `simulators/` | Enhets-, marknads- och felsimulatorer. |
| `docs/` | Arkitektur, kontrakt, driftinstruktioner, acceptans och verkligt verifierad byggstatus. |

Domäntjänsternas avsedda kataloger är `api-gateway/`, `identity-service/`, `tenant-service/`, `asset-service/`, `connector-service/`, `control-service/`, `price-service/`, `tariff-service/`, `true-cost-service/`, `optimizer/`, `forecasting-service/`, `flexibility-service/`, `pool-service/`, `market-service/`, `bsp-gateway/`, `dispatch-service/`, `measurement-service/`, `baseline-service/`, `verification-service/`, `settlement-service/`, `revenue-service/`, `ledger-service/`, `prequalification-service/`, `compliance-service/`, `policy-service/`, `webhook-service/`, `notification-service/` och `simulator-service/`.

Framtida Edge-kod kan ligga i ett separat repo, `flexexa-edge`.

## 77 Infrastruktur containrar och CI

OpenTofu är huvudverktyget för infrastruktur. Terraform-kompatibel modul- och providerstruktur behålls där det är praktiskt.

Infrastrukturen omfattar VPC, ECS/Fargate, ECR, lastbalanserare, S3, KMS, Secrets Manager, RabbitMQ, Valkey, IAM, övervakning och DNS.

Backendtjänster har Dockerfiles. Lokal Docker Compose ska kunna starta CitrineOS, RabbitMQ, Valkey, simulatorer, stödtjänster och vid behov Supabase lokalt. Produktion ska köras i AWS och inte vara beroende av utvecklarens dator.

GitHub ska använda skyddad `main`, PR-flöde, obligatoriska CI-checks, CODEOWNERS, beroendeskanning och relevanta granskningskrav.

CI-katalogen för PR:er omfattar lint, typkontroll, enhets- och integrationstester, migrationsvalidering, ren migrationsreplay, RLS, tenantisolering, RPC, API-kontrakt, OpenAPI-kompatibilitet, säkerhets- och beroendeskanning, Dockerbygge, Next.js-bygge och Python-tester.

Frontend går från GitHub till Vercel Preview, genom relevant E2E och därefter till produktion. Backend går genom GitHub Actions, bygge, skanning, ECR, ECS-test och integrationstester innan produktion.

GitHub ska använda OIDC mot AWS. Permanenta AWS-nycklar i GitHub ska undvikas.

## 78 Obligatoriska tester för tenant och behörigheter

CI måste bevisa följande tolv fall:

1. Tenant A kan inte läsa Tenant B:s kund.
2. Tenant A kan inte läsa Tenant B:s enhet.
3. Tenant A kan inte skapa en plats med Tenant B:s `customer_id`.
4. Tenant A kan inte skapa en enhet med Tenant B:s `site_id`.
5. Tenant A kan inte lägga Tenant B:s enhet i en normal tenantportfölj.
6. En tenantadministratör kan inte ge sig själv en plattformsroll.
7. En viewer kan inte skicka enhetskommandon.
8. Finance kan inte styra enheter som standard.
9. Operator kan inte godkänna settlement som standard.
10. Developer kan inte styra produktionsenheter utan uttrycklig behörighet.
11. Återkallat medlemskap förlorar åtkomst inom definierad tid för cacheinvalidering.
12. Aggregering över tenants kan bara göras genom auktoriserad plattformstjänst och skapar revisionsspår.

## 79 Obligatoriska tester för RPC och samtidighet

CI måste bevisa att:

- Identisk idempotensnyckel inte skapar dubblettkommandon.
- Två samtidiga reservationer inte kan överboka samma kapacitet.
- Ett duplicerat externt settlement-ID inte leder till dubbel ledgerpost.
- Otillåtna tillståndsövergångar avvisas.
- Tenantfel avvisas även om `tenant_id` manipulerats i indata.
- Obalanserad ekonomisk transaktion inte kan commitas.
- Publicerad regelversion inte kan redigeras.
- Åtagandet sparar policy- och behörighetsversion som användes när det accepterades.
- Duplicerad aktivering eller dispatch dedupliceras.
- Gammal telemetri blockerar eller minskar marknadskapacitet enligt gällande policy.

## 80 Rådata replay och simulering

Råpayloads lagras i S3 när användningsrätt och teknik medger det. Det gäller settlement, marknadsdispatch, tariffimport, leverantörswebhooks och kritiska OCPP- eller styrhändelser. Innehållets hash ska sparas.

Replay ska stödja priser, tariffer, väder, platslast, fordonsbeteende och marknadshändelser.

Viktiga versionsreferenser är `optimizer_version`, `policy_set_version_id`, `rule_evaluation_id`, `baseline_method_version`, `eligibility_calculation_version` och `settlement_calculation_version`.

Simulatorn ska kunna skalas stegvis till 10, 100, 10 000, 100 000 och 1 000 000 resurser. Varje skala behöver eget faktiskt testresultat innan kapaciteten påstås vara bevisad.

Scenarier omfattar anslutning och urkoppling, SOC, laddhastighet, nätverksfel, prisändring, leverantörsavbrott, flexhändelse, ofullständig leverans, gamla mätdata, kundöverstyrning och duplicerad dispatch.

Flex shadow ska byggas före riktiga pengar och visa fysisk tillgänglighet, säkert bud, simulerad dispatch och prognostiserad leverans. Shadow settlement ska redovisa marknadsintäkt, BSP-avgift, BRP-påverkan och andelar för elhandlare, OEM, kund och Flexexa. Simulerade belopp hålls åtskilda från verkliga belopp.

## 81 Country packs

All landsspecifik logik ska ligga i country packs.

`country-packs/se` ska innehålla elområden, valuta, tidszon, skattelogik, priskonfiguration, tariffkällor, TSO-konfiguration, aktörsidentifierare, flexproduktkonfiguration, mätregler och språk.

Senare tillkommer `no`, `dk`, `fi`, `de`, `nl` och andra EU-länder. En landsutökning ska inte kopiera regelmotor, kundmodell eller settlementmotor till ett separat parallellt system.

## 82 Integritet och dataskydd

Personuppgifter, platshistorik och fordonshistorik ska minimeras. Identitet hålls åtskild från stora telemetriströmmar där det är praktiskt.

Plattformen ska ha samtyckeslogg, retentionpolicy, export, raderingsflöde, anonymisering, tenantdataexport och kontroller för behandling av data.

Retention ska kunna styras per datakategori. Ledger-, audit- och marknadsposter får inte tas bort om tillämpligt bevarandekrav kräver att de hålls kvar. Radering ska därför hantera olika datakategorier enligt deras gällande krav.


## 83 Byggordning och leverans per fas

Detta är den fullständiga beslutade fasordningen. Omfattningen kommer från basplanen. Kontrollpunkterna nedan förklarar hur leveranserna ska bedömas tillsammans med den gemensamma Definition of Done i avsnitt 84. De ersätter inte fysiska tester, partnergodkännande eller marknadens krav.

Varje fas ska bygga vidare på samma modeller, databas, Kernel, API och revisionsspår. Tidig design och simulering får förbereda senare faser, men får inte användas som bevis för att en senare verklig leverans är klar.

| Fas | Leverans |
| --- | --- |
| 0 | Verifierad grundplattform. |
| 1 | Verklig smart laddning med kundflöde, partnerportal och API. |
| 2 | Full svensk kostnad och lastoptimering. |
| 3 | Utökad egen anslutningsförmåga och fler tillverkare. |
| 4 | Simulerad flexibilitet genom hela leverans- och ekonomiflödet. |
| 5 | Verifierad BSP-pilot inom avtalad resurs- och produktomfattning. |
| 6 | Flera BSP-partners med separata giltiga pooler. |
| 7 | Lokal flexibilitet för nätägare och lokala marknader. |
| 8 | Samordning av sol batteri och fastighetsenergi. |
| 9 | Lokal Edge och OEM-integration. |
| 10 | Licensierad Nord Pool-data i produktion. |
| 11 | Länderexpansion med country packs. |
| 12 | Teknisk beredskap för direkt BSP-modell där den är tillåten. |
| 13 | V2H och V2G med dubbelriktad laddning. |

### Fas 0 Grundplattform

**Mål:** En gemensam teknisk och säker grund som kan bära verklig laddstyrning, marknadsbeslut och ekonomiska transaktioner.

**Omfattning:** Monorepo, CI, Docker, OpenTofu, AWS-grund, Supabase/Postgres, ClickHouse, RabbitMQ, Valkey, organisationer och tenants, kanoniska scheman, tenantseparerade sammansatta främmande nycklar, RLS, RBAC, Kernel och regelmotor, händelsekontrakt, API-konventioner, audit, övervakning, providerarkitektur och country packs.

**Arbetsordning:** Fortsätt från den faktiska befintliga implementationen. Stäng kvarvarande skillnader mellan kod, migrationshistorik, databas, kontrakt och infrastruktur. Driftsätt och verifiera relevanta tjänster, deras identiteter och privata anslutningar. Bevisa policypublicering och giltighet, beständig hantering av händelser samt övervakning och återställning.

**Godkännande:** Samma källversion ska ha relevanta gröna kontroller för kod, databas, tenantisolering, RLS, behörighet, samtidighet och infrastruktur. Den deklarerade driftmiljön ska dessutom ha aktuell verifiering av tjänsteversion, åtkomst, kommunikation, larm, återställning och rollback. En grön frontend eller en isolerad container räcker inte.

**Nuvarande fortsättning:** Slutför granskning av PR #51, kör den korrigerade befintliga AWS-processen med dess oförändrade skydd och bevisa slutligt synkat tillstånd. Stäng övriga dokumenterade grundkrav innan fas 0 markeras klar.

### Fas 1 Verklig smart laddning

**Mål:** Kunden ansluter en bil eller laddare, anger när bilen ska vara klar och får fysisk laddning enligt en säker optimerad plan.

**Omfattning:** White label, kunder, platser och enheter, marknadsaktörer och platsrelationer, OCPP/CitrineOS, Enode som adapter, Elprisetjustnu, grundtariff, laddpreferenser, true cost, optimerare, styrning och device shadow, PWA, partnerportal, externt API och webhooks.

**Det sammanhängande flödet:**

1. Partner och kund skapas i rätt tenant.
2. Kunden lämnar rätt samtycke och ansluter leverantör eller laddare.
3. Flexexa upptäcker och normaliserar resursen.
4. Färsk status och verkliga förmågor hämtas.
5. Kunden anger laddmål, avresetid och tillåtna styrval.
6. Priser och grundtariff hämtas.
7. Optimeraren skapar en plan inom kundens och platsens gränser.
8. Regelmotor och behörighet godkänner rätt styrväg.
9. Kommando eller schema skickas genom adapter.
10. Uppföljning mäter vad som faktiskt hänt.
11. Kundens mål och resultat visas i PWA, portal och API.
12. Avvikelser ger ett explicit fel och en definierad reservstrategi.

**Godkännande:** En överenskommen fysisk resurs ska demonstrera hela flödet, inklusive paus eller effektbegränsning där det stöds, återhämtning och laddmål före avresa. Återkallat samtycke, offlineenhet, gammal telemetri, dubblettkommando och providerfel ska hanteras korrekt. Hela fasens portal-, API- och integrationsomfattning måste också uppfyllas; ett enda fungerande laddtest godkänner inte alla providers.

### Fas 2 Full svensk kostnad och lastbalansering

**Mål:** Optimera efter vad laddningen faktiskt kostar kunden inklusive relevant elhandel, nät och effektpåverkan.

**Omfattning:** RISE Eltariff, Sourceful eller direkta DSO-adaptrar, elhandelstariffer, skatt, månadens toppstatus, HAN/P1, lastbalansering och total kostnadsoptimering.

**Leverans:** Rätt versionsbestämd tariff knyts till rätt plats. Kostnadsmotorn bryter ned priset. Mätning av fastighetens last gör att laddningen kan undvika säkringsöverskridande och onödiga effekttoppar inom kundens laddmål.

**Godkännande:** Tariffkomponenter, tidsfönster, giltighet, skatt, moms, toppberäkning och jämförelse mot baslinje ska kunna reproduceras. Mätbortfall och ändrad hushållslast ska ha säker hantering. Besparing visas som beräknad eller uppföljd enligt sitt underlag.

### Fas 3 Utökad anslutningsplattform

**Mål:** Fler resurser ansluts direkt utan att kärnmodellen eller resten av systemet blir leverantörsberoende.

**Omfattning:** Tesla direkt, Easee, Zaptec, Volvo, BMW, Mercedes, VW Group, SolarEdge, SMA och batteritillverkare.

**Prioritering:** Välj nästa adapter efter verklig efterfrågan, tillgängliga kommersiella och tekniska villkor, tillförlitlighet, supportarbete och kostnad per ansluten enhet.

**Godkännande:** Varje adapter ska bevisa autentisering eller motsvarande anslutning, upptäckt, normalisering, faktisk förmåga, färska mätvärden, tillåtna kommandon och felhantering i sitt avtalade omfång. En leverantör utan skrivstöd ska redovisas som sådan. Enode ska inte tas bort från alla flöden samtidigt; ersättning sker kontrollerat per förmåga och resurs.

### Fas 4 Flexibilitet i shadow mode

**Mål:** Bevisa hela flexibilitetsmodellen utan verkliga bud, marknadsåtaganden eller pengar.

**Omfattning:** Marknadsaktörer, BSP/BRP/DSO, produkter, portföljer, behörighet, förkvalificeringsmodell, prognoser, reservationer, MockBspAdapter, dispatchsimulator, mätning och baslinjer, settlementsimulator, ledger och BRP-påverkan.

**Leverans:** En simulator skickar marknadshändelser genom verkliga kanoniska hanterare. Flexexa räknar tillgänglighet, reserverar kapacitet, väljer enheter, följer simulerad eller tillåten observationsbaserad leverans och skapar ett separat shadow settlement.

**Godkännande:** Ingen överlappande reservation får överboka fysisk eller gemensam platskapacitet. Dubbletter, samtidiga anrop, delacceptans, sen aktivering, uteblivet svar, gammal telemetri, avvikande leverans, avgifter, sanktioner och rättelser ska ha testade utfall. Alla simulerade värden ska märkas som simulerade och får inte utlösa utbetalning.

### Fas 5 BSP-pilot

**Mål:** Genomföra verklig flexibilitet med en namngiven partner, produkt och resursgrupp.

**Omfattning:** Första riktiga BSP:n, verklig tillgänglighet, åtaganden, aktivering och dispatch, mätning och verifiering, settlementimport, avstämning, intäktsfördelning och kundbelöningar. Flexexa behåller kundidentitet, enhetsidentitet och styransvar enligt den avtalade modellen.

**Inträdeskrav:** Partnerns gränssnitt och säkerhet ska vara dokumenterade. Produkt, aktörsmodell, resursgrupp, mätmetod, tillämplig förkvalificering, avtalsansvar och nödvändiga godkännanden ska vara verifierade. Köpare, tekniskt ansvarig och driftansvarig måste vara tydliga enligt V1.1-förslaget.

**Leverans:** Partner skickar eller godkänner faktisk marknadshändelse. Flexexa reserverar rätt kapacitet, styr tillåtna resurser, mäter utfallet, rapporterar kortfall och importerar verkligt settlement. Godkända belopp fördelas enligt rätt avtal.

**Godkännande:** Partnern accepterar integrationen och den avtalade mät- och leveransmetoden. Verkliga kommandon och resultat kan spåras genom hela flödet. Driftstopp, incident, köåterhämtning och rollback är testade. Slutacceptans kräver uppmätt resultat inom överenskommen omfattning; försäljningsintresse är inte ett godkännande.

### Fas 6 Flera BSP-partners

**Mål:** Stödja flera BSP-partners samtidigt utan att blanda felaktiga aktörsrelationer eller dubbelboka resurser.

**Omfattning:** Pool A kan gå till BSP A, pool B till BSP B och pool C till BSP A. Senare kan optimeraren välja partner efter tillträde, avgifter, tillförlitlighet, produktstöd och settlementkvalitet.

**Godkännande:** Partneråtkomst, produkter, credentials, pooler, reservationer och avräkning ska vara separerade och tidskorrekta. Ett resursbyte får inte ändra historisk leverans eller flytta ett pågående åtagande utan tillåten överlämning. Implicit aggregering mellan BSP:er är inte tillåten.

### Fas 7 Lokal flexibilitet

**Mål:** Leverera flexibilitet där en nätägare eller lokal marknad faktiskt behöver den.

**Omfattning:** Första DSO:n eller lokala flexleverantören, geografiska begränsningar, kapacitetsersättning, aktivering, skydd mot överlappande produkter och settlement.

**Godkännande:** Varje resurs ska kopplas till rätt nätområde och mätpunkt. Produktens lokala begränsningar, samtidiga åtaganden och mätkrav ska kontrolleras. Ett behov i ett nätområde får inte mötas med kapacitet som bara råkar finnas i samma större elområde.

### Fas 8 Sol batteri och fastighetsstyrning

**Mål:** Samordna flera energiresurser så att laddning inte optimeras isolerat från resten av fastigheten.

**Omfattning:** SunSpec, batteri- och soladaptrar, SMHI-prognos, batterioptimerare, fastighetsoptimerare samt HVAC eller värmepump.

**Godkännande:** Gemensamma import- och exportgränser, batteri-SOC, verkningsgrad, säkerhetsgränser, komfort eller mobilitet och befintliga flexåtaganden ska respekteras. Prognosfel, frånkoppling och konflikter mellan resurser ska kunna hanteras. Samma energi eller besparing får inte räknas flera gånger.

### Fas 9 Edge och OEM

**Mål:** Flytta nödvändig lokal funktion till platsen och ge tillverkare en tydlig integrationsväg.

**Omfattning:** Flexexa Edge byggd på EVerest, OEM-SDK och väg till fabriksintegration.

**Godkännande:** Lokala giltiga scheman och policybilder ska fungera vid molnavbrott. Säkringar, faser, effektgränser och kommandovalidering måste bevaras. Uppdatering och återställning ska hålla säkerhetsgränserna. OEM-integrationen använder Flexexas kanoniska kontrakt.

### Fas 10 Nord Pool i produktion

**Mål:** Använda licensierad prisdata med dokumenterad rätt för den faktiska kommersiella användningen.

**Omfattning:** Rätt kommersiella datarättigheter, NordPoolPriceProvider som primär provider och Elprisetjustnu som tillåten reserv.

**Godkännande:** Rättigheter för visning, lagring och eventuell vidareförmedling ska vara bekräftade. Upplösning, valuta, enhet, publicering, kvalitet, slutstatus och fallback ska vara spårbara. Providerbyte får inte ändra det kanoniska pris- eller optimeringskontraktet.

### Fas 11 Länderexpansion

**Mål:** Införa nya länder med gemensam kärna och tydligt avgränsad lokal logik.

**Omfattning:** Norge, Danmark och Finland först, därefter Tyskland, Nederländerna och andra relevanta marknader.

**Godkännande:** Country pack ska omfatta rätt elområden, valuta, tidszon, språk, skatt, tariffer, aktörer, produkter och mätregler. Partner- och marknadstillträde måste verifieras per land. Historik över tidsomställning och valuta får inte bli tvetydig.

### Fas 12 Direkt BSP-beredskap

**Mål:** Ha tekniken redo för en framtida direkt BSP-modell som är förenlig med Flexexas beslutade roll.

**Omfattning:** FlexexaDirectBspAdapter, CIM, ECP, Nordic MMS eller annat direktmarknadsgränssnitt, kvittenser, säkerhet och certifikat.

**Godkännande:** Adapter och kommunikation ska vara testade, men driftaktivering kräver också uppfylld aktörsmodell, avtal, förkvalificering och externa marknadskrav. Om en aktuell modell inte tillåter den beslutade rollen ska funktionen hållas avstängd tills en tillåten modell eller uttryckligen granskad planändring finns.

**Arkitekturgräns:** Förberedelse för direkt BSP är inte i sig ett beslut att Flexexa ska bli BRP.

### Fas 13 Dubbelriktad laddning

**Mål:** Stödja energi från bilen till fastighet eller nät när kombinationen av bil, laddare, installation och avtal tillåter det.

**Omfattning:** OCPP 2.1, ISO 15118-20, dubbelriktad laddning, modell för batterislitage, exporttariffer, V2H och V2G-optimering eller flexibilitet.

**Godkännande:** Hårdvarans verkliga förmåga, installationens exportgränser, mätning, kundens batteri- och avresekrav samt tillämpligt marknads- och nätavtal ska verifieras. Import, export och lastminskning får inte sammanblandas i mätning eller ekonomi.


## 84 Gemensam Definition of Done

Hela Flexexa-plattformen får inte beskrivas som produktionsklar innan följande krav är verifierade. En avgränsad pilot eller utrullning innebär inte att hela plattformen är godkänd:

- Tenantisolering fungerar och tenantrelationer är databassäkrade.
- RLS och RBAC fungerar, inklusive förbjudna anrop.
- Ren migrationsreplay är grön och kritiska RPC:er är testade.
- Kommandoidempotens fungerar och device shadow är verifierad.
- Leverantörsfel och säkra reservvägar är testade.
- Tariffversionering fungerar och optimerarens mobilitetskrav är testade.
- Revisionsspår är komplett och ClickHouse-pipelinen är testad.
- Flexkapacitet kan inte överbokas.
- Åtaganden sparar tillämpade regel- och behörighetsversioner.
- Ledger balanserar och settlementavstämning fungerar.
- Ersättning kan hänföras till varje enhets verkliga bidrag.
- BRP-, BSP-, elhandlar- och DSO-attribution är korrekt.
- White label fungerar och externt API är dokumenterat.
- Anropsgränser finns och webhooks är signerade.
- Återställning är testad och relevanta belastningstester har genomförts.
- OCPP-interoperabilitet och BSP-simulator är testade.
- Gamla mätdata och duplicerad aktivering är testade.
- Säker reservstyrning fungerar.
- Kritisk regelpublicering har tester, godkännande och ny beredskapsutvärdering.
- Aggregering över tenants fungerar endast genom en uttryckligen privilegierad och granskad väg.

Kraven ska bevisas på aktuell kandidat och i rätt miljö. Ett tidigare grönt resultat får bara återanvändas inom sin faktiska version och omfattning.

## 85 Regler som aldrig får brytas

1. Varje tenantägd rad har `tenant_id`.
2. Tenantrelationer säkras av databasen.
3. Kund, plats, enhet och portfölj får aldrig tyst kopplas över tenantgränser.
4. Kanoniska modeller delas från början.
5. Leverantörsmodeller stannar vid adaptergränsen.
6. Dynamiska affärsregler ligger i central policy- och regelmotor.
7. Fysisk säkerhet är deterministisk och lokal och har företräde framför dynamiska regler.
8. Behörighet kontrolleras genom permissions, inte bara rollnamn.
9. Kritiska skrivningar använder transaktionell RPC eller applikationstjänst.
10. Ingen tjänst får generell åtkomst över tenants utan uttryckligt behov.
11. Plattformen får inte låsas till Enode.
12. Plattformen får inte låsas till en OEM.
13. Plattformen får inte låsas till Nord Pool.
14. Plattformen får inte låsas till en BSP.
15. Flexexa ska inte bli BRP.
16. Flexexa ska ändå hantera BRP-relationer fullständigt.
17. Stora råtelemetriströmmar ska inte ligga i affärs-Postgres.
18. Flexibilitet får inte dubbelbokas.
19. Settlement får inte ske utan spårbart underlag.
20. Marknadsintäkt får inte blandas med modellerad besparing.
21. Molnkommandon får inte åsidosätta fysisk säkerhet.
22. Flexibilitet får inte bryta mobilitetsgarantin.
23. Extern indata är opålitlig tills den validerats.
24. Kommandon ska vara idempotenta och möjliga att granska.
25. Pengar ska bokföras med dubbel bokföring.
26. Marknadsprodukter ska vara data och konfiguration där det är möjligt.
27. Tidsberoende aktörsrelationer får inte förenklas bort.
28. Aggregering över BSP:er får inte ske implicit.
29. Aggregering över DSO:er ska respektera geografi och nätbegränsningar.
30. Baslinjer ska vara versionsstyrda.
31. Optimerare ska vara versionsstyrda.
32. Behörighetsberäkningar för marknadsdeltagande ska vara versionsstyrda.
33. Settlementberäkningar ska vara versionsstyrda.
34. Licenser för öppen källkod ska registreras och granskas.
35. Infrastruktur ska kunna reproduceras.
36. Kritiska data ska ha spårbar källa.
37. Kritiska marknadshändelser ska kunna spelas upp igen.
38. Styrsystemet ska fungera oberoende av frontend.
39. Kundens mobilitet har företräde framför intäktsoptimering.
40. Historiska händelser ska använda historiska policy- och regelversioner.
41. Feature flags och affärsregler ska hållas åtskilda.
42. Publicerade regler ska vara oföränderliga.
43. Ny relevant policyversion ska ge en ny tenantberedskap.
44. Varje kritisk regel ska ha automatiserade testfall.
45. En ledgertransaktion får inte commitas om debet inte är lika med kredit.

## 86 Frågor plattformen måste kunna besvara

### Resurser och kapacitet

- Hur många enheter styr vi?
- Vilka är online?
- Vilken fysisk flexibilitet finns?
- Vilken säker flexibilitet finns?
- Vilken prognostiserad flexibilitet finns vid P50, P80, P90 och P95?
- Vilken kapacitet kan säkert bjudas ut?
- Var finns flexibiliteten geografiskt?
- Vilken kapacitet är redan reserverad?
- Vilken kapacitet återstår?
- Vad behöver kunden före avresa?

### Marknadsrelationer och ansvar

- Vilken DSO och vilket nätområde gäller?
- Vilket elområde gäller?
- Vilken elhandlare gäller?
- Vilken BRP gäller?
- Vilken BSP gäller?
- Vilken aggregatorrelation gäller?
- Vilken relation och vilket avtal gällde vid exakt detta klockslag?
- Vilken tenant och kund äger varje bidragande resurs?
- Vilken marknad ger bäst riskjusterat värde?
- Vilken BSP-väg ska användas?
- Vilken BRP-påverkan uppstod?

### Kostnad och pengar

- Vad är kundens verkliga energikostnad?
- Hur mycket sparades genom smart laddning?
- Hur mycket sparades genom nättariffer?
- Hur mycket tjänades på flexibilitet?
- Vad betalade BSP, DSO eller marknaden?
- Vilka avgifter och sanktioner tillämpades?
- Vad ska elhandlaren få?
- Vad ska OEM få?
- Vad ska BSP få?
- Vad ska Flexexa få?
- Vad ska varje kund få?

### Leverans beslut och spårbarhet

- Vilken effekt begärdes?
- Vad levererades?
- Vilken baslinje användes?
- Vilken mätkälla användes?
- Vilka policy- och regelversioner fattade beslutet?
- Varför valde optimeraren denna plan?
- Varför valdes dessa enheter?
- Kan varje kommando reproduceras?
- Kan varje marknadshändelse spelas upp igen?
- Kan varje krona eller euro stämmas av?
- Kan varje settlementrad spåras till fysisk leverans?

Om plattformen inte kan besvara frågorna korrekt och med underlag är arkitekturen inte komplett.

## 87 Instruktion för implementation

Varje utvecklare eller byggagent ska följa följande tolv regler:

1. Bygg kanoniska scheman och migrationer före genvägar i UI.
2. Lägg till sammansatta tenantseparerade främmande nycklar när tenantägda objekt refererar till varandra.
3. Lägg till RLS- och behörighetstester när varje tabell skapas.
4. Lägg kritiska skrivningar bakom RPC eller applikationstransaktion.
5. Anropa central policy- och regelmotor i stället för att duplicera regler.
6. Knyt marknads-, styr- och settlementbeslut till exakta versioner.
7. Använd outbox och idempotens för externa sidoeffekter.
8. Skapa revisionsspår och källspårning för marknad, styrning, åtkomst och pengar.
9. Kör ren migrationsreplay.
10. Kör tester för tenantisolering.
11. Kör samtidighets- och idempotenstester för RPC.
12. Markera aldrig en fas klar innan dess Definition of Done är grön.

Repots operativa instruktioner kräver även att relevanta källavsnitt, `skills-lock.json`, faktisk byggstatus, implementation och berörda lokala skills läses före väsentligt arbete.

Före icke-trivial ändring ska `pnpm plan:check`, `pnpm index:codebase` och `pnpm impact -- --base <target-ref>` användas. Rapporten över direkt och indirekt påverkan ska läsas. Kör `pnpm verify:affected -- --base <target-ref>` och varje domänkontroll som påverkan kräver.

Ändringar i centrala modeller, Kernel, events, API-kontrakt, migrationer, RLS, RBAC, policy, optimering, flex, dispatch, ledger eller infrastruktur ska följa repots fulla verifieringskrav. Riktade kontroller används under arbetet; den frysta slutkandidaten ska ha aktuell full verifiering innan den accepteras.

Migrationshistorik får inte skrivas om för att lösa en senare ändring. Kod, databas, kontrakt och konsumenter ska synkas genom nya korrekt verifierade ändringar.

`pnpm plan:ready` måste vara godkänd innan hela planen påstås vara klar. Ett grönt register visar bara att registrerade bevis är kompletta enligt kontrollen; varje verkligt test och godkännande måste också granskas.


## Bilaga Leveransacceptans enligt det öppna V1.1-tillägget

Denna bilaga återger och förklarar kravförslaget i PR #51. Tillägget ändrar inte de 88 basavsnitten eller de 14 faserna och var ännu inte mergat vid kontrollen den 1 oktober 2026.

De tio kraven har status planerade i täckningsregistret. De 31 fallen nedan är acceptansspecifikationer. De är inte en redovisning av redan genomförda fysiska tester eller partnergodkännanden.

Tillägget ska göra ett sammanhängande flöde prövbart: kund, plats och enhet; samtycke och koppling; färska observationer; säker laddning; tillgänglighet och reservation; partnerinstruktion; uppmätt leverans; avstämd settlement; operatörs- och kundvy.

### Typer av bevis

| Typ i källan | Vad som ska visas |
| --- | --- |
| `ci` | Verkligt körd automatiserad kontroll mot rätt källversion och kontrakt. |
| `physical` | Tidsstämplad mätning av vad en riktig överenskommen resurs faktiskt gjorde. |
| `operations` | Genomförd kontroll i den deklarerade driftsatta miljön, exempelvis larm, stopp och återställning. |
| `partner` | Granskat externt accepterat resultat för en namngiven partner, produkt och omfattning. |

Ett bevispaket ska innehålla implementationsvägar, kanoniska kontrakt, migrationer, påverkan på konsumenter, körda tester, miljö, oföränderlig käll- eller artefaktidentitet och granskare. Känsliga avtal, kunddata och credentials ska hållas utanför det publika repot. Endast sanerad referens och innehållshash ska registreras där.

En offlinevalidator kan kontrollera att registrerade bevis är kompletta och har rätt hash. Den kan inte bevisa att en fjärrkörning eller ett externt godkännande verkligen inträffade. Faktiska körningar och underlag måste granskas.

### FXP 01 Grundplattform och källparitet

**Koppling:** Basavsnitt 3, 77, 78, 79 och 83. Fas 0. Inga föregående FXP-krav.

Applikation, databas, genererade kontrakt, infrastruktur och granskning ska utgå från en sammanhängande kandidat. Redan applicerade migrationer bevaras oförändrade. Gamla statusobservationer som ersatts av senare arbete ska avstämmas uttryckligen.

- **FXP-01-T1 — ci:** Ren replay, schemakatalog och genererade kontrakt ska upptäcka avsiktlig drift. Historiska migrationer får inte tyst skrivas om.
- **FXP-01-T2 — ci:** Negativa tester mellan två tenants, förbjudna skrivningar, idempotens och oförändrad basplansinventering ska passera på samma kandidat. En punkt utan verifierat underlag håller planberedskapen falsk.
- **FXP-01-T3 — operations:** Faktisk deployment och version, begränsad kommunikation, livstecken, larm, backupåterställning och rollback ska bevisas i angiven miljö. Öppna grundkrav redovisas; de får inte godkännas enbart genom CI.

### FXP 02 Anslutning och samtyckets livscykel

**Koppling:** Basavsnitt 18, 36, 37, 39, 49 och 82. Fas 1. Kräver FXP-01.

Anslutningsstatus, teknisk styrberedskap och produktens marknadsbehörighet är separata bedömningar. Systemet ska visa exakt blockeringsorsak och vem som kan åtgärda den.

Registrerad, auktoriserad, upptäckt, färskt observerad och styrtestad är steg i den tekniska anslutningen. De ersätter inte förkvalificering. Ägande, miljö, samtyckets omfång och giltighet samt enhetsförmåga ska kontrolleras i kommandotransaktionen och igen före sändning.

- **FXP-02-T1 — ci:** Giltig anslutning inom rätt omfång ska lyckas. Saknat, återkallat eller utgånget samtycke, fel tenant, fel enhet och sandboxcredentials i produktion ska stoppa åtgärden före extern skrivning.
- **FXP-02-T2 — ci:** Samtycke som återkallas medan kommando väntar i kö ska stoppa senare dispatch. Okända observationer får inte omvandlas till noll, falskt eller online.
- **FXP-02-T3 — physical:** En riktig överenskommen anslutning ska visas från auktoriserad upptäckt till tidsstämplad telemetri och styråtgärd, med enhet, provider, version och mätunderlag.

### FXP 03 En fysisk last med flera observationsvägar

**Koppling:** Basavsnitt 3, 35, 36, 37, 39 och 51. Faser 1 och 4. Kräver FXP-02.

Bil, laddarkontakt, laddsession, plats och mätpunkt ska ha en verifierad tidsberoende relation. Flera feeds kan beskriva samma last. Det får inte skapa flera kapacitetsbidrag.

Matchning får inte bygga enbart på obetrodd VIN-text, namn eller geografisk närhet. Okänd eller tvetydig relation ska uteslutas från kommersiell aggregering tills den verifierats.

Det ska finnas en aktiv skrivauktoritet per fysisk session med skydd mot att tidigare ägare fortfarande styr. En ny läsväg får inte automatiskt bli en ny skrivväg.

- **FXP-03-T1 — ci:** Bil- och laddarfeeds för samma session ska ge ett enda kapacitetsbidrag och en enda aktiv styrägare även vid samtidig upptäckt och återanslutning.
- **FXP-03-T2 — ci:** Byte av uttag, gamla sessionshändelser, providerbyte och försenade kvittenser får inte flytta ägande felaktigt, återuppliva återkallad väg eller dubbelräkna energi.
- **FXP-03-T3 — ci:** Okända kopplingar ska uteslutas. En normal tenant får inte koppla en annan tenants enhet. Tillåten plattformsaggregering behåller ägande och audit.

### FXP 04 Säkra kommandon och uppmätta utfall

**Koppling:** Basavsnitt 2, 38, 39, 45, 54 och 79. Faser 1 och 4. Kräver FXP-03.

Begärt, auktoriserat, skickat, providerbekräftat, observerat och slutfört är skilda tillstånd. HTTP-framgång eller ACK är inte en verifierad fysisk leverans.

Idempotens, giltighet, orsakskedja, policyversion och styrägande ska bestå genom återförsök, fel och omfördelning. Fysiska platsgränser är obligatoriska. Avbrutet åtagande ska ge incident, relevant partnerinformation och konservativ återstående tillgänglighet.

Återhämtning ska ha begränsad ramp och planerad återhämtningslast så att alla resurser inte startar samtidigt.

- **FXP-04-T1 — ci:** Dubbletter, krasch och återförsök, timeout, gammal policy, utgångna meddelanden och kvittenser i fel ordning får inte skapa upprepad eller försenad styrning. Fel ska vara synliga.
- **FXP-04-T2 — ci:** Säkerhetsgränser, kundöverstyrning och omöjligt avresemål ska påverka planen korrekt. Telemetri- eller anslutningsbortfall ska trigga definierad fallback och stoppa åtaganden utan underlag.
- **FXP-04-T3 — physical:** Paus eller minskning och återhämtning ska mätas på rätt enhet. Responstid, faktisk effekt och mobilitetsutfall ska visas, även när ACK kommer utan fysisk respons.
- **FXP-04-T4 — ci:** Konkurrerande styrvägar och samtidiga återhämtningar får inte överskrida platsgränser eller återanvända kapacitet som är kontrakterad någon annanstans.

### FXP 05 Konservativ kapacitet och reservation

**Koppling:** Basavsnitt 35, 46, 47, 49, 50, 51 och 79. Fas 4. Kräver FXP-04.

Systemet ska redovisa nominell, tekniskt tillgänglig, konservativ säker, reserverad och kvarvarande kapacitet per intervall, riktning, varaktighet och produkt. Varje uteslutning eller nedskrivning ska förklaras.

För V1G ska lastminskning skiljas från export. Ökad laddning begränsas av genomförbar laddmarginal. Baslinje, prognos, indataålder, osäkerhet och version sparas. Statistiska percentiler får inte beskrivas som kalibrerade utan kalibrering och backtest.

Reservationer ska vara atomiska mot den fysiska gränsen och omfatta överlappande produkter, energi, återhämtning och platskapacitet. Samma kontroll upprepas när åtagandet accepteras. UTC-intervall ska förbli entydiga över svensk tidsomställning.

- **FXP-05-T1 — ci:** Frånkopplade eller fulladdade bilar, gamla mätdata, omöjlig avresa, negativ marginal och osäker identitet får inte öka kapaciteten. kW, kWh och tecken ska vara uttryckliga.
- **FXP-05-T2 — ci:** Samtidiga reservationer och återförsök får inte överboka fysisk eller gemensam platskapacitet. Avbokning och delacceptans frigör bara relevant reservation.
- **FXP-05-T3 — ci:** Tillgänglighet ska backtestas mot observationer som inte använts i modellbygget. Fel, kalibrering och uteslutningar redovisas. Intervallgränser, dubbla klockslag och tidsluckor ska testas.

### FXP 06 Utbytbar BSP-adapter och begränsad partneråtkomst

**Koppling:** Basavsnitt 18, 55, 56, 57, 60, 78 och 82. Faser 4 och 5. Kräver FXP-05.

Befintligt BSP-gränssnitt och kanoniska scheman ska användas. Därefter byggs en adapter mot en bekräftad partner. Bixias eller en annan partners fält, transport, credentials och svarstider är inte bekräftade enbart genom plantexten.

Partnern ser som standard auktoriserade pooler, perioder och aggregat. Råa personuppgifter, VIN eller platsdata kräver uttryckligt ändamål och rättighet. Ingen generell partnerroll får ge all tenantdata.

Credentials och webhooks ska stödja rotation, omfång, tidsstämpel, replay-skydd och idempotens. Återkallelse kontrolleras igen på köat arbete.

- **FXP-06-T1 — ci:** Simulatorn ska täcka accepterad, avvisad, delvis accepterad, duplicerad och sen aktivering samt nätfel, felaktig indata och rättelser genom verkliga kanoniska handlers.
- **FXP-06-T2 — ci:** Fel tenant, pool eller miljö, dålig signatur, replay, återkallade credentials och otillåten rådataåtkomst ska misslyckas utan extern effekt eller dataläckage.
- **FXP-06-T3 — partner:** Den valda adaptern ska provas mot partnergodkänt kontrakt och testendpoint. Förväntat resultat och faktisk extern acceptans ska registreras.

### FXP 07 Tidskorrekt behörighet och externa förutsättningar

**Koppling:** Basavsnitt 49, 50, 59, 60 och 81. Faser 4 och 5. Kräver FXP-06.

Produktregler ska ha källa, giltighetsintervall, granskningsdatum, ansvarig och godkännandeunderlag. Bedömningen använder de elhandlar-, BRP-, BSP-, DSO- och områdesrelationer som gäller vid leveranstiden.

Samtycke och relevant enhets- eller gruppförkvalificering kontrolleras. Tekniska, marknadsmässiga och kommersiella beslut är separata och ska ha orsakskoder. Framtida aktörsmodeller hålls avstängda tills de verifierats.

Ett befintligt BRP-avtal är inte i sig ett Flexexa-BSP-avtal.

- **FXP-07-T1 — ci:** Saknad eller utgången kvalificering, fel kombination av BRP, BSP eller område, saknad regelversion och saknat partneravtal ska stoppa marknadsåtgärden. Giltiga kombinationer ska fungera.
- **FXP-07-T2 — ci:** Aktörsbyte under leveransfönster ska dela eller avvisa rätt intervall. Replay behåller ursprungligt beslut och avvisar motstridiga överlappningar.
- **FXP-07-T3 — partner:** Produkt, enhet eller grupp, mätmetod, aktörsmodell och nödvändiga avtal eller godkännanden ska bekräftas för piloten före marknadsskrivning.

### FXP 08 Mätning och verifierbar leverans

**Koppling:** Basavsnitt 37, 53, 54, 61 och 80. Faser 4 och 5. Kräver FXP-07.

Begärd, kvitterad, uppmätt, verifierad och externt avräknad mängd ska hållas isär. Källa, händelsetid, mottagningstid, kvalitet, enhet, intervall, baslinje, optimerings- och policyversioner samt rättelsekedja sparas.

Saknad telemetri får inte bli begärd eller levererad effekt. Rättelser ska skapa nya versioner. Den kommersiella jämförelsen mot befintlig smart laddning är separat från marknadsproduktens leveransbaslinje. Samma flyttade energi får inte räknas två gånger som vinst.

- **FXP-08-T1 — ci:** Duplicerad, försenad, saknad eller felordnad mätning, räknarreset, fel enhet och klock- eller intervallfel får inte skapa obestyrkt leverans eller skriva över underlag.
- **FXP-08-T2 — physical:** En verkligt uppmätt aktivering ska kunna återspelas från kommando till verifierade intervallmängder. ACK utan respons förblir overifierad och kortfall redovisas.
- **FXP-08-T3 — partner:** Partnern ska acceptera leveransmetod, baslinje och datakvalitet för rätt produkt och mätgräns. Ett ROI-exempel ersätter inte detta.

### FXP 09 Avstämning och avtalsstyrd ekonomi

**Koppling:** Basavsnitt 61, 62, 63, 64, 65, 79 och 80. Faser 4 och 5. Kräver FXP-08.

Varje belopp ska spåras genom avtalets version, statement och rad, leveransintervall, aktivering, fysisk källa, mätning och beräkningsversion.

Uppskattat, verifierat och partneravräknat resultat är olika. Endast godkänt avstämt belopp får nå utbetalningsflödet. Importer och rättelser är idempotenta med balanserad ledger, spårbara reverseringar, avrundning, valuta, skatt och avvikelsehantering.

Mjukvarulicens och driftad flexibilitetstjänst är separata avtalsmodeller. Avdrag och fördelning ska ha uttrycklig bas, ordning, giltighet och tak. Köparens marginal ska kunna visas efter kundbelöningar, BSP-kostnader, mjukvara och drift.

- **FXP-09-T1 — ci:** Duplicerade statement- och radimporter samt samtidiga bokningar eller återförsök ska ge ett enda beständigt ekonomiskt resultat. Obalanserade poster och otillåtna valuta- eller enhetskombinationer stoppas atomiskt.
- **FXP-09-T2 — ci:** Delavräkning, sanktion, tvist, rättelse och avrundning ska bevara källkedja och balans. Beräknad intäkt får inte trigga utbetalning.
- **FXP-09-T3 — ci:** Olika avtalsversioner och licensmodeller ska ge reproducerbar fördelning utan dubbelräknad besparing. Senare avtalsändring får inte skriva om redan bokförd historik.

### FXP 10 Operatörsflöde pilotbevis och releasebeslut

**Koppling:** Basavsnitt 55, 56, 61, 62, 71, 75, 77, 78, 80 och 83. Fas 5. Kräver FXP-09.

Operatören ska följa ett gemensamt flöde från tillgängliga resurser och uteslutningar till åtaganden, pågående styrning, avvikelser, verifierad leverans och ekonomi.

Varje värde visar källa och om det är simulerat, uppskattat, uppmätt eller avräknat. Kund-, partner- och operatörsvyer använder samma kanoniska data.

Före pilot ska köpare, tekniskt ansvarig, driftansvarig och acceptansgranskare utses. Rekrytering av resurser, enhets- och providerscope, KPI:er, mätperiod, responstoleranser, support, rollback, retention, export och stoppvillkor ska överenskommas. Pris, resursantal och revenue share får inte antas från ett säljsamtal.

Piloten ska jämföras mot motpartens befintliga arbetsflöde och redovisa anslutningsarbete, anslutningskvalitet, verklig respons, mobilitetsutfall, kortfall och nettofördel för köparen. Utrullningen ska vara begränsad och ha testad stoppfunktion och incidentskalering. Utgångna externa godkännanden leder till ny bedömning.

- **FXP-10-T1 — ci:** Browser-, API- och datatester ska visa ett sammanhängande flöde, tydliga uteslutningar och rätt märkning av simulerade, uppskattade, uppmätta och avräknade värden. Otillåten läsare får inte styra eller godkänna settlement.
- **FXP-10-T2 — operations:** Driftsatt övervakning, provideravbrott, operatörsstopp, köåterhämtning, rollback och bevarad audit ska provas för pilotens verkliga scope.
- **FXP-10-T3 — partner:** Överenskomna inträdeskrav och slutlig köpar- och teknisk acceptans eller avvisning ska registreras med uppmätta resultat.

### Arbetsordning för förändringar och bevis

Varje implementationspaket ska kopplas till befintliga baspunkter och relevanta FXP-fall. Kör planinventering och påverkan före ändring. Utöka befintliga kanoniska modeller och transaktioner i stället för att skapa en providerspecifik parallell datamodell.

Schemaändring följs av ren replay, RLS, förbjudna tenantanrop och samtidighetskontroller, faktisk schemaläsning, kontrakt eller typgenerering samt tester av konsumerande API och UI.

Styrändring kräver timeout, replay, skydd mot gammal styrägare, fallback och relevant fysisk mätning. Ekonomisk ändring kräver bevis för dubbletter, samtidighet, reverseringar och debet/kredit. Partnerändring kräver kontraktstester, sanerade payloadexempel och extern granskning.

Slutkandidaten ska ha aktuell ordinarie CI och uppfyllda gransknings- och skyddsregler. Krav får inte stängas enbart för att det normala lyckade fallet fungerar eller en schemafil är giltig.

När tillägget införs ska `plan:ready` kräva både V1 och tilläggets registrerade beredskap på en oförändrad ren kandidat. Kontrollens resultat är bevisintegritet, inte ett automatiskt tillstånd till fysisk styrning, marknadsskrivning eller utbetalning.

### Partnerbeslut som återstår att fastställa

För vald pilot måste vi fastställa om partnern är köpare, återförsäljare, marknadsväg eller flera av dessa. Vi behöver bekräfta befintlig integrationslösning, resursåtkomst, ansvar, dataåtkomst, accepterad mätmetod och baslinje, säkerhet, gränssnitt, kostnader och villkor för övergång till produktion.

Bixia eller någon annan partner ska inte bli en egen exklusiv kärnmodell. Ett omnämnt API eller ett befintligt BRP-förhållande bevisar inte BSP-avtal, produktgodkännande eller köpintresse.

Uppgifter om marknadsroll och förkvalificering i originaltillägget bygger på källor granskade den 18 september 2026. Reglernas faktiska giltighet måste verifieras på nytt före leverans. Denna svenska läsversion gör inget nytt påstående om aktuellt marknadstillträde.

## Källor och dokumentgräns

- [Låst masterplan V1 på kontrollerad foundationversion](https://github.com/heke99/flexexa/blob/f1e5c231e0fe5da40050ed2a50bb8cef6844bba8/FLEXEXA_MASTER_BUILD_PROMPT_V1.md)
- [Operativt agentkontrakt på samma version](https://github.com/heke99/flexexa/blob/f1e5c231e0fe5da40050ed2a50bb8cef6844bba8/AGENTS.md)
- [Byggstatus i foundation](https://github.com/heke99/flexexa/blob/f1e5c231e0fe5da40050ed2a50bb8cef6844bba8/docs/progress/BUILD_STATUS.md)
- [Öppet V1.1-tillägg på kontrollerad kandidat](https://github.com/heke99/flexexa/blob/88c8122a2665e79b61b4bacac0b44e176e03c7b0/docs/plans/FLEXEXA_DELIVERY_ACCEPTANCE_V1_1.md)
- [PR #51 med tilläggets senaste publika status](https://github.com/heke99/flexexa/pull/51)
- [PR #50 med webbshellens avgränsade leverans](https://github.com/heke99/flexexa/pull/50)
- [Senaste registrerade manuella AWS-apply vid kontrollen](https://github.com/heke99/flexexa/actions/runs/35195030570)

Byggstatusfilen innehåller äldre observationer från september. De kompletterades här med senare PR-, branch- och Actions-information. Dokumentet är en plan och en svensk förklaring av källkraven, inte ett nytt driftgodkännande. Låst basplan ändras bara genom versionsstyrd, granskad och spårbar ändring.
