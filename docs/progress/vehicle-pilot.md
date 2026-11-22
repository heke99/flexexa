# Fordonskatalog och Enode-pilot · steg 2

Datum 2026-11-22. Katalogutdraget är lokalt verifierat mot källan. Anslutning, telemetri och styrning på verkliga pilotbilar väntar på leverantörsåtkomst och utsedd provutrustning. [Reviderad byggordning](../FLEXEXA_REVISED_BUILD_ORDER_2026-11-22.md) · [Första laddpiloten](charging-pilot.md)

## Normaliserat katalogutdrag

EEA:s slutliga 2023-underlag, version v28, innehåller svensk nyregistreringsdata för BMW 330e (PHEV) och BMW i4 eDrive40 (BEV). i4 eDrive40 är föreslagen provvariant. Den faktiska BMW 330e av årsmodell 2023 behöver identifieras med pilotbilens underlag. Om den är en annan kommersiell variant, exempelvis 330e xDrive, behövs en uttrycklig variantmatchning innan katalogposten länkas. [Uppgiftskälla och licens](https://sdi.eea.europa.eu/catalogue/srv/api/records/87fd2bce-6ad5-46d8-af41-f27cfd2e45a8)

| Normaliserat fält | Underlag och betydelse |
| --- | --- |
| `make`, `model` | EEA:s `Mk` och `Cn` verifieras mot exakt namn. Visningsnamnen normaliserar skiftläget och källans värde finns kvar i `source.modelName`. |
| `powertrain` | Kombinationen `Ft` och `Fm` krävs. `petrol/electric` och `P` ger PHEV. `electric` och `E` ger BEV. |
| `registeredIn`, `registrationYear` | `MS` och `Year` avser Sverige och året för nyregistreringsunderlaget. Modellår kräver separat underlag. |
| `id`, `source` | Flexexas stabila uppslagsnycklar och proveniens med källversion och reproducerbart urval. Nycklarna identifierar katalogposter. |

Varje uppslag hämtar en offentlig rad för det avgränsade modellnamnet. Utdraget har attribution, länk till CC BY 4.0 och ändringsbeskrivning. Datasetets metadata anger DG CLIMA som rättighetshavare och EEA för publicering. Lagring, visning och vidareleverans av dessa EEA-fält omfattas av licensen med attribution och bevarad innebörd. Nuvarande utdrag används lokalt. Vid publicering ska källan och licensvillkoret följa utdraget. Batterikapacitet, laddgräns, laddmätning, providerstatus och uppgifter om enskilda fordon ligger utanför källurvalet. [Katalogutdrag](vehicle-pilot.catalog.json) · [EEA:s villkor](https://www.eea.europa.eu/en/legal-notice/) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

EV Database har en avtalad exportväg. Leverantörens kostnadsfria väg kräver förhandstillstånd, manuell hantering och oförändrad publicering. Använd EEA-utdraget för de verifierade katalogfälten. Bedöm EV Database först vid ett konkret fältbehov med uttryckliga rättigheter för normalisering, lagring och eventuell vidareleverans. Ett svenskt registreringsuppslag kan utvärderas när pilotflödet behöver det, med ändamål och åtkomst beslutade för vägtrafikregistret. [EV Database](https://ev-database.org/data-services-api) · [Transportstyrelsens direktåtkomst](https://www.transportstyrelsen.se/sv/vagtrafik/fordon/fordons-agaruppgift/direktanmal-och-sok-i-vagtrafikregistret/ansok-om-att-soka-uppgifter-i-vagtrafikregistret/)

### Reproducera utdraget

Kör från Flexexa-repots rot med Node 24. Körningen läser två offentliga EEA-frågor och skriver katalogen till standardutmatningen. De lokala testerna använder fasta svar.

```sh
node --use-env-proxy scripts/catalog/vehicle-pilot.mjs > /tmp/flexexa-vehicle-pilot-catalog.json
diff -u docs/progress/vehicle-pilot.catalog.json /tmp/flexexa-vehicle-pilot-catalog.json
node --test test/vehicle-pilot-catalog.test.mjs
```

Den 22 november gav båda liveuppslagen en verifierad källrad och samma JSON som det sparade utdraget. Alla tre lokala katalogtester passerade med Node 24.19.0. Kontrollerna gäller katalogen och dess källurval.

## Pilot med Enode

Enodes publika BMW-lista visar 330e och i4 i Europa med stöd på modellfamiljsnivå för laddstatus och start/stopp. Enode listar bland annat BMW ConnectedDrive Remote Services, krav på primär användare samt situationer då en laddbox behöver länkas för att möjliggöra styrning. Fältens aktualitet, faktisk åtkomst och styrning behöver verifieras per anslutet exemplar. Enodes aktuella utvecklarsida kräver inloggning i plattformen. [Enodes BMW-matris](https://platform.enode.com/brands/BMW) · [BMW:s anslutningsåtgärder](https://platform.enode.com/brands/learn/BMW/interventions) · [Enodes utvecklaråtkomst](https://developers.enode.com/)

Laddbackenden i `charging-subscription` har en separat energi-runtime och ett simulerat flöde för acceptans av plan, kö, skugga och mätutfall. Anslut Enode vid styrbackendens leverantörsgräns när det aktuella kontraktet är verifierat och låt kundflödena läsa den kanoniska statusen. Samma fysiska resurs ska fortsatt ha en aktiv styrväg. Om BMW kräver länkat ladddon ska pilotprotokollet ange var den faktiska styrningen och mätningen sker. [Energi-runtime](https://github.com/heke99/charging-subscription/blob/c26766fdfb2d1b3872d245f77301e2b5888c9aa7/src/energy-api-runtime.mjs) · [Första laddpiloten](charging-pilot.md)

| Ordning | Prov och beslutbart utfall |
| --- | --- |
| 1. Tillgång och kontrakt | Integrationsägaren får ett avgränsat Enode-testprojekt, region EU och tillgång till gällande SDK/API. Dokumentera fält, källtider, rättigheter för lagring/visning/vidareleverans, kvoter per miljö och debiteringsgrund. Bekräfta pilotplats, exakt 330e-variant, vald BEV, respektive fordonskonto, giltigt läsmandat och separat styrmandat. |
| 2. Sandbox | Kör leverantörens Link-flöde genom Flexexas konto, API och arbetsprocess med virtuella fordon. Prova avbruten länkning, frånkoppling, gammal SoC, dubbletter, försenad händelse, kvotrespons, tappad kommandokvittens och återkallat mandat före dispatch. Fäst resultat vid revision och miljö. [Enode Sandbox](https://enode.com/updates/introducing-the-new-sandbox-enhanced-device-testing-for-standout-energy-apps) |
| 3. Läsning på de två bilarna | Länka varje utsedd bil med ägarens mandat. Matcha marknad, typ, variant och årsmodell mot pilotunderlaget. Mät försök och lyckade anslutningar per bil, senaste leverantörsmättid för SoC, ankomstdatum, tillgängliga kapabiliteter och lyckad återanslutning. Redovisa anslutning per bil och antal försök. Den lilla piloten kan ge ett observerat utfall per kombination, med separat prov för att uppskatta flottans anslutningsgrad. |
| 4. Styrning och mätning | Kör start, paus, återupptagning och slutvärde med övervakad laddplats, verifierad mätpunkt och gällande platsgränser. Samla tid för begäran, kvittens, återläst tillstånd och bekräftad fysisk effekt. Stäm av leverantörens eventuella sessionstal mot mätpunktens uppmätta kWh. Logga SoC-ålder och energikälla separat. Följ [R46 och R58](charging-pilot.md). |
| 5. Utvärdering | Redovisa användbara data- och styrfält, mätavvikelser, anrop och avtalad kostnadsbas per aktiv bil. Vid en betydande lucka, kör samma kontroller på samma pilotvariant med Smartcar där avtalet medger. Utvärdera direktadapter när ett verifierat gap motiverar arbetet. [Smartcars EU-täckning](https://smartcar.com/product/compatible-vehicles/eu) |

Spara anonymiserad kombination av modellvariant, marknad, konto och firmware, revisioner, tidsserie med käll- och mottagningstid, kvot och debiteringsgrund, sessionskWh och referensmätning. Märk utfallen per funktion och provmiljö. Fullständiga fordonsidentifierare och ägaruppgifter hör hemma i pilotmiljöns avsedda system. Katalogposterna innehåller inga funktionstillstånd för drift. Inställd eller indragen åtkomst ska synas genom status och kommandogrindar även för redan köade jobb.

**Nästa handling för integrationsägaren och pilotansvarig** är att tilldela Enode-klientens sandbox, utse bekräftad BEV och tillgängliggöra rätt laddplats och pilotmandat. Kör sedan punkt 2 med verifierat API-kontrakt innan verklig bil ansluts.

Skills för deluppdraget är repots `verification` och `investigation-mode` samt datautbytesprofilen. Inspelning av levande telemetri, databas och klientaktivering hör till respektive integrationsleverans.
