# Smartladdning i partnerappen – byggplan och BMW-pilot

Datum: 2026-11-05
Status: föreslagen genomförandeplan för granskning; inga nya adresser eller funktioner driftsätts genom dokumentet.
Bas: phase/0-foundation, 8913e997d889c78c1c657c09d0095a8807a4e7f8.

## Beslut och avgränsning

Kunden använder Gridex eller annat elbolags befintliga app/kundwebb för all daglig användning.
Flexexa ansvarar för samtliga fordons- och laddboxintegrationer, kanoniska enheter, planering,
kostnadsberäkning och styrning. Flexexas webb öppnas vid anslutning och nödvändig återanslutning,
med säker återgång till partnerappen. Ingen dubbelregistrering eller automatisk kontomatchning
på e-post eller registreringsnummer.

Flera bilar och laddpunkter stöds per kund/anläggning, med individuella laddmål och gemensamma
effektgränser. Bil, laddpunkt och fysisk laddsession är separata resurser. Okänd koppling får
inte ersättas av en gissning.

Detta byggspår avser smartladdning. Det ändrar inte det separata laddabonnemanget och aktiverar
inte publik laddning, roaming, flexibilitetsmarknader eller utbetalningar.

V1 och V1.1 behåller samtliga krav och faser. Detta dokument föreslår ett partnerappflöde inom
befintligt API/SDK-stöd; det tar inte bort kundwebb/PWA från den långsiktiga basplanen.
BMW-förstudien kan förberedas tidigt men innebär inte att Connect-expansion eller någon fas är klar.

## Miljöer och domäner

| Yta | Föreslagen testadress | Avsedd produktionsadress |
| --- | --- | --- |
| Partner-API | api-staging.flexexa.com/v1 | api.flexexa.com/v1 |
| Anslutning | connect-staging.flexexa.com | connect.flexexa.com |
| Företagsportal | portal-staging.flexexa.com | portal.flexexa.com |
| Intern administration | admin-staging.flexexa.com | admin.flexexa.com |
| Gridex kundgränssnitt | Separat skyddad Gridex-preview | Befintliga Gridex Mina sidor/app |

Testadresserna är förslag, inte konstaterade DNS-poster. Huvudsajten flexexa.com/www.flexexa.com
ska inte användas som testbackend. Återanvänd först Vercels skyddade preview-adresser om DNS
ännu inte är färdig. Leverantörens callback- och app-returadresser måste godkännas separat
per miljö, med state/replay-skydd och en tillåten lista över returadresser.

Next.js-gränssnitt körs på Vercel. API, Connect, optimizer och kontroll körs enligt V1 i
AWS ECS/Fargate. Supabase/Postgres är transaktionell källa; RabbitMQ, Valkey, ClickHouse och S3
behåller sina beslutade roller. Infrastruktur ändras genom OpenTofu.
Test- och produktionsbehörigheter, externa providerkonton, köer och datalagring ska hållas
åtskilda. flexexa-dev är befintlig utvecklingsmiljö, inte automatiskt godkänd produktionsmiljö.
Verifiera om testmiljön kan använda den isolerat innan ytterligare miljöresurser skapas.

## Pilotbil och BMW-gräns

Pilotbil: BMW 330e, årsmodell 2023, laddhybrid. BMW ConnectedDrive finns enligt användaren.
Laddbox/laddmetod, åtkomst till datapunkter, fysisk effekt och kommandoförmåga är ännu okända.
Ingen batterikapacitet, laddhastighet eller API-kompatibilitet antas från modellnamnet.

BMW CarData dokumenterar fordonsdata och kundens godkännande. Det bevisar inte att Flexexa
har rätt att starta eller stoppa denna bil. Verifiera dataläsning och laddstyrning separat:
- företagsåtkomst, tillåtna användningsändamål och villkor;
- kundgodkännande och faktisk enhetsupptäckt;
- tillgängliga datapunkter, kvalitet, tidsstämpel och uppdateringsfrekvens;
- verkliga styrmöjligheter, eventuella separata partnerkrav och modellbegränsningar.

Personlig kostnadsfri CarData-användning får inte antas täcka en kommersiell partnerplattform.
Om BMW-anslutningen endast ger läsåtkomst kan laddboxen vara den verifierade styrvägen.
Saknas styrbar laddbox och tillåten bilstyrning fortsätter piloten med data och skuggplanering.
En andra bil simuleras tills ytterligare fysisk testbil finns; detta märks tydligt i bevisen.

Källor kontrollerade 2026-11-05:
- https://www.bmwgroup.com/en/general/regulations/cardata.html
- https://bmw-cardata.bmwgroup.com/thirdparty/public/
- https://bmw-cardata.bmwgroup.com/customer/public/
- https://bmw-cardata.bmwgroup.com/customer/public/api-documentation

Inga kunduppgifter, VIN, lösenord eller åtkomsttoken får läggas i detta publika repo.
Kundens godkännande sker i leverantörens flöde. Hemligheter hanteras enligt befintlig
Secrets Manager/KMS- och credential-reference-modell.

## EnergyWizard – återanvändning och anpassning

Bevara originalet som referens. Före kopiering dokumenteras ursprung, version och tillämpliga
licensvillkor. Den granskade zippen anger AGPL-3.0 i README men saknar den länkade licensfilen.
En separat process eller domän är inte i sig ett licensundantag.

| Modul | Avsedd användning och nödvändig anpassning |
| --- | --- |
| decisions.py | Explicit indata i stället för globala DB-/väder-/learning-läsningar; inga dolda morgonmål eller fasta lokala tariffregler. |
| gpm.py | Utvärdera EV-prioritering; separat runtime-tillstånd per anläggning, planversion och återstart. |
| ev_handshake.py | Tilldelningsunderlag; fysisk bil–laddpunktskoppling måste verifieras eller bekräftas. |
| plan_brief.py | Språkneutrala API-förklaringar, målkonflikter och orsak till planbeslut. |
| timeline.py | UTC-intervall, korrekta energiaggregat och vårens/höstens tidsomställningar. |
| health.py | Datans ålder, anslutningsfel och konservativ hantering av saknade värden. |
| fuse_guard.py | Granska fysisk gränshantering och reservbeteende; ersätter inte lokal elektrisk skyddsfunktion. |

EnergyWizard är underlag, inte en andra kunddatabas eller alternativ integrationsplattform.
Befintliga Home Assistant-drivare är inte färdiga direkta OEM-adaptrar.
V1:s separata Python-optimizer och LP/MILP med HiGHS/OR-Tools behålls. Återanvända heuristiker
ska inte ersätta gemensamma constraints eller skapa parallella affärsregler utanför Kernel.

## Byggpaket i ordning

| Paket | Leverans | Avgränsat godkännande |
| --- | --- | --- |
| A – källa och miljö | Stäm av foundation mot publik webbgren, kvarvarande fas-0-grindar, miljöbehörigheter och DNS/certifikatplan. | En källversion och explicita öppna driftgrindar; inget påstående om färdig plattform. |
| B – kontrakt och simulator | Utöka befintliga kanoniska kontrakt för laddmål, sessionstilldelning, planversion och kostnadsunderlag. Två simulerade bilar. | Partnerbackend kan ändra avresetid för bil A; anläggningens gemensamma plan räknas om utan att bil B:s preferenser ändras. |
| C – optimizer och kostnad | Isolerad planering, gemensam true-cost-funktion och versionsbestämda indata/resultat. | Genomförbarhet, effektgränser, tariffvariation och alla verkliga tidsintervall verifieras. |
| D – partnergränssnitt | Gridex Mina sidor/preview med bilval, veckoschema, mål, Ladda nu, priser, historik och fel. Minsta supportportal. | All vardagshantering stannar i Gridex; samma auktoritativa resultat visas i API och portal. |
| E – BMW och laddbox | Tillåten dataläsning, kundens godkännande, färskhetskontroll och vald styrväg. | Ansluten, dataläsbar och styrbar är separata statusar; faktiska förmågor visas. |
| F – driftsatt skuggtest | Samma flöde på testdomänerna, med riktig data där tillåtet men utan styrkommandon. | Inloggning, tenantgränser, planändring, kostnader, händelser och driftlarm verifieras. |
| G – fysisk laddning | En överenskommen session med verklig styrning, mätning, återhämtning och stoppfunktion. | Skickat kommando, mottagningsbekräftelse och uppmätt laddning hålls isär. |
| H – andra partnern | Separat testtenant och partnerklient med samma API. | Ingen Gridex-specifik identitet, tariff eller integration är hårdkodad. |

Kontrakt och simulatorförberedelse kan fortsätta medan externa BMW-villkor klarläggs.
Fysiska skrivningar aktiveras först när pilotens tillämpliga fas-0-, säkerhets-, samtyckes-
och kontrollgrindar är verifierade. En godkänd demo ersätter inte hela fasens Definition of Done.

## Kostnadsvisning

Partnerappen visar kundens relevanta elavtalspris och planerad laddkostnad, med separat
uppdelning för elhandel, rörlig nätöverföring, energiskatt och moms.
Effektavgift beräknas enligt anläggningens faktiska tariff och totala belastning; den är inte
ett generellt fast kWh-påslag per bil. Fasta hushållsavgifter visas separat eller med tydligt
angiven fördelningsmetod. Saknade tariffer visas som saknade, inte som noll.
Skilj planerad, uppskattad och mätbaserad kostnad. Mätgräns och laddförluster är explicita.
Avtalsmodell och faktisk priskälla måste överensstämma mellan Gridex och Flexexa.

## Första kodleverans och verifiering

Första kod-PR: Smartcharging foundation and optimizer contract, med kanoniska kontrakt,
simulerade enheter, reproducerbara planändringar och dokumenterad EnergyWizard-gräns.
Ny typ-, migrations- och optimizerkod följer AGENTS fulla högriskgrindar.

Verifiera minst:
1. Två bilar, olika avresetider och gemensam effektgräns.
2. Delad laddkontakt kan inte användas samtidigt av två bilar.
3. Avstängt schema skapar inget dolt 50-procentsmål kl. 06.
4. Otillräcklig tid och saknad SOC ger ett uttryckligt osäkert/ouppnåeligt mål.
5. Båda tidsomställningarna bevarar verkliga intervall och energi.
6. Två olika tariffmodeller fungerar utan ändring av kärnlogik.
7. Tenantbyte eller manipulerat kund-/enhets-ID nekas.
8. Ladda nu respekterar fysisk effekt och planversion.
9. Dubbla händelser och återförsök skapar inte dubbla kommandon.
10. Återkallat samtycke stoppar även ännu ej skickade köade kommandon.

Kravspårning: V1 §§3, 18, 35–45, 66–69, 71–83; V1.1 FXP-01 till FXP-04 samt relevanta
operativa delar av FXP-10. Detta dokument registrerar inga godkända acceptansfall.

## Granskningsnotering

Dokumentändring: ingen runtime-, schema-, infrastruktur-, DNS- eller providerändring.
Läst: AGENTS, skills-lock, V1:s relevanta avsnitt, V1.1, Connect ADR/gräns/överlämning,
BUILD_STATUS och flexexa-code-review. Kodindex/impact och högriskverifiering aktiveras
vid kod-/kontraktsändringen; migrations-, browser- och driftsättningsflöden är inte
tillämpliga på denna dokumentändring. Ingen oberoende granskning eller produktionsacceptans
självcertifieras.
