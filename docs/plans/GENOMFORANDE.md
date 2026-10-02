# Flexexa — genomförande av hela masterplanen

Kontrollerat 2026-10-02. Detta är arbetsordning och navigering, inte ett nytt
driftgodkännande eller en ändring av den låsta arkitekturen. Läs alla krav i
[V1](../../FLEXEXA_MASTER_BUILD_PROMPT_V1.md) och [V1.1](FLEXEXA_DELIVERY_ACCEPTANCE_V1_1.md).
Den [svenska läsversionen](FLEXEXA_MASTERPLAN_SV.md) bevarar avsnitt 0–87 och faser
0–13. När en formulering behöver tolkas är originalkraven styrande.

## Faktiskt utgångsläge

Implementationens målgren är `phase/0-foundation`. Hela produktgrenen ska inte
mergas till `main` innan dess relevanta acceptans är klar. `main` har separata,
avgränsade webb- och infrastrukturprojektioner. Ingen webbstatus bevisar laddstyrning.

| Paket eller observation | Verifierat vid kontrollen | Återstående gräns |
| --- | --- | --- |
| Runtime PR #52, `39eb1e58ba07057b55a810852fe8c363a83b67b0` | Samtliga sju jobb i körning `36985725145`, quality och OpenTofu-plan passerade. Granskade image-rapporter: noll HIGH/CRITICAL. | Identity-ändringens externa granskning är kapacitetsblockerad; PR:n är öppen. |
| Plan PR #51, `c1a8882e719a4b1def85ee26767a261f0dde8410` | Samtliga sju jobb i `36986078151`, quality `36986078179` och plan `36986078082` passerade. Två tidigare plananmärkningar är åtgärdade och trådarna lösta. | Kandidaten inkluderar #52; merge ska ske efter dess granskning och merge. |
| Låst V1 | 88 avsnitt, 14 faser och 3 701 källpunkter; SHA-256 `5b1f7abdbff8c291082f9b48be5a1713ac910098898dc654115a13c82b7d687e`. | Inventering är inte verifiering av varje produktkrav. |
| FXP-register | Tio krav, 31 acceptansfall, alla fortfarande planerade utan registrerade leveransbevis. | Fysiska, operativa och partnerrelaterade resultat ska samlas under respektive fas. |
| AWS | Senaste registrerade manuella apply `35195030570` skapade 52 grundresurser men föll i slutkontrollen. Avgränsad rättning är publicerad på `main`. | Ny godkänd main-körning, konvergerad slutplan och oberoende aktuell readback återstår. Ingen ny livekontroll görs av detta dokument. |

De aktuella isolerade databasjobben omfattar 791 SQL-assertioner, verklig Auth/MFA
på host och i container, återhämtning av brokerhantering och logisk restore av
1 338 katalogobjekt, 72 tabeller och 20 migrationsrader. Detta ersätter inte aktuell
readback från den deklarerade driftmiljön eller hosted PITR. Äldre observationer i
BUILD_STATUS och progressfiler ska läsas med sina datum och exakta bevisomfång.

## Nästa arbetsordning i fas 0

| Ordning | Genomförande | Bevis som behövs före godkännande | Original / FXP |
| --- | --- | --- | --- |
| 1 | Granska slutlig identity-fix; merge #52 och därefter #51 genom ordinarie skydd. Verifiera nya heads, målgren och relevanta checks före varje merge. | Verklig granskning, aktuella lyckade körningar och bibehållna källträd. En rate-limited status räcker inte. | §§71, 77, 83 / FXP-01-T1, T2 |
| 2 | Kör den befintliga manuella OpenTofu-processen på skyddad `main` med `confirm=APPLY_DEV`. Bevara sparad plan, låsning, exakt tillåtet resursomfång och separata plan/apply-roller. | Lyckad apply, konvergerad slutplan samt oberoende aktuell resurs- och versionsreadback. Om start inte finns i anslutningen ska blockeringen redovisas; skapa ingen alternativ skrivväg. | §§28, 71, 73, 77 / FXP-01-T3 |
| 3 | Färdigställ hosted service-/API-klienters credentiallivscykel och godkännanden/nödåtkomst i samma kanoniska modell. | Begränsat omfång, rotation/återkallelse/giltighet, MFA/step-up, oberoende godkännande, concurrency och audit; nekade tenant- och återspelningsfall. | §§15–24, 68, 71 / FXP-01, senare FXP-02/06 |
| 4 | Färdigställ policybindning, produktionskriterier, signerad publicering och giltighetskontroll. | Aktuell publiceringsidentitet, ny-version-readiness, förbjudna bindningar, stale/expired/revoked policy och säker fallback. | §§9–14, 26, 85 / FXP-01, 04 |
| 5 | Driftsätt godkända backend- och outbox/inbox-paket med privata anslutningar och minsta rättigheter. | Exakta imageversioner/signaturer/skanning, liveness/readiness, TLS, least privilege, retry/crash/ACK-förlust, idempotenta affärseffekter och rollback i rätt miljö. | §§28–31, 71, 73, 77 / FXP-01-T3 |
| 6 | Slutför deployed observability, dashboards, larm och tillämpliga restore-/säkerhets-/lastgrindar. | Larm som faktiskt utlöses, incidentväg, återhämtning, sekretess/åtkomst, uppmätta lastresultat och deklarerat RPO/RTO. | §§70–73, 77–80 / FXP-01-T3 |
| 7 | Färdigställ foundationdelarna för providerlivscykel och verifiera hela fasens sammanhängande källparitet. | Samma migrationshistorik/kontrakt/kod/deployment, relevant RLS/RBAC/concurrency, tenantnegativfall och aktuella scoped bevis. Ingen fysisk kontroll godkänns från mock. | §§3, 18–23, 35–39, 66, 78–84 / FXP-01, 02 |

Detta är beroendeordning, inte löfte om att ett enda paket slutför hela fasen.
Kod och regressioner som inte kräver molnåtkomst kan fortsätta medan en extern
driftgrind är blockerad. Ett sådant paket måste fortfarande ha verifierad slutkandidat
och kan inte stänga den blockerade operativa acceptansen.

## Hela fortsättningen efter grundplattformen

| Fas | Genomför hela originalomfattningen | Exitgräns |
| --- | --- | --- |
| 0 | Grundplattform, samtliga punkter ovan och originalets grundkrav. | Verifierad kod, databas, infrastruktur och relevant driftmiljö. |
| 1 | White label, kunder/sites/assets, actorrelationer, OCPP/CitrineOS och Enode, priser/grundtariff, preferenser/true cost/optimizer, control/shadow, PWA/portal/API/webhooks. | En överenskommen verklig laddkedja från samtycke till uppmätt utförande och avresemål; hela fasens övriga scope kvarstår. |
| 2 | Svensk full kostnad: RISE Eltariff, Sourceful/direkt DSO, retailer tariff/skatt, peak state, HAN/P1, lastbalansering och total-cost-optimering. | Reproducerbar tariff/tax/tidsversion och säker lastoptimering med riktiga underlag. |
| 3 | Direkt Connect-expansion: Tesla, Easee, Zaptec, Volvo, BMW, Mercedes, VW Group, SolarEdge, SMA och batteri-OEM efter verifierade villkor och efterfrågan. | Adaptervis verifierad förmåga, normalisering, fel/reconnect och faktisk kontroll där den stöds. |
| 4 | Flex shadow: actors, produkter/pooler, eligibility/prequalification, prognos, atomisk reservation, MockBspAdapter, dispatch/M&V/baseline, shadow settlement/ledger/BRP impact. | Hela interna flödet, dubbletter/concurrency och balanserad ekonomi i shadow; inga riktiga bud eller pengar. |
| 5 | BSP-pilot: avtalad partner, riktig tillgänglighet/commitment/dispatch, M&V, settlementimport/avstämning, allocation/rewards. | Rätt partner-/produkt-/resursscope, fysisk leverans, extern acceptans och tillämpliga marknadsgodkännanden. |
| 6 | Multi-BSP med separata pooler och senare val efter tillträde, avgifter, tillförlitlighet och settlementkvalitet. | Auktoriserad routing, ingen dubbelbokning och korrekt attribution mellan alla aktörer. |
| 7 | Första DSO/lokala flexprovider, geografiska begränsningar, kapacitetsbetalning/aktivering, överlappsskydd och settlement. | Godkänd lokal integration och spårbar leverans utan produktöverlapp. |
| 8 | SunSpec, sol-/batteriadaptrar, SMHI, batteri-/hushållsoptimering och HVAC/värmepump. | Faktiska mätningar och säker samordning inom varje enhets förmågor. |
| 9 | Flexexa Edge baserat på EVerest, OEM SDK och fabriksintegrationsväg. | Lokal säkerhet, giltig policy, offline/fencing/återanslutning och verifierad interoperabilitet. |
| 10 | Kommersiella datarättigheter, NordPoolPriceProvider primär och Elprisetjustnu fallback. | Dokumenterat användningsomfång och verifierad version/färskhet/fallback. |
| 11 | Country packs för NO/DK/FI, senare DE/NL/EU. | Landvis regler, tariff/tax, currency/timezone, actor-/produktkrav och verifierad integration. |
| 12 | FlexexaDirectBspAdapter, CIM/ECP/Nordic MMS, ACK/säkerhet/certifikat. | Teknisk beredskap och aktivering först när tillämplig marknadsroll/krav faktiskt uppfyllts. Flexexa blir inte BRP. |
| 13 | OCPP 2.1, ISO 15118-20, dubbelriktning, degradering/exporttariffer, V2H/V2G-optimering och flex. | Verifierad fysisk och protokollmässig dubbelriktning med giltiga nät-/avtals-/säkerhetsvillkor. |

## Bevarande och granskning

Utöka befintliga kanoniska kontrakt, migrationer och riktiga anropsvägar.
Historiska migrationer får inte skrivas om. Fysisk säkerhet och mobilitetskrav
har företräde; resurs-, marknads- och finansauktoritet kan inte skapas av ett
planfält eller en språkmodell. Bevis får bara registreras för faktiskt granskat
scope och aktuell implementation. Ingen fas eller punkt markeras klar av denna
dokumentation. `plan:ready` är fortsatt false tills dess verkliga krav är uppfyllda.

Aktiverade färdigheter för detta dokumentpaket: codebase-index, impact-analysis,
affected-verification, code-review, security-review och test-strategy; filfärdigheten
användes för den befintliga svenska källan. Databas-/cloud-/provider-/browsermutationer
är inte del av dokumentändringen. Relevant upstream verification används vid nästa
implementationspaket. Nästa kodpaket ska väljas från verkligt kvarstående grundkrav
efter kontroll av aktuella sources, migrationshistorik, konsumenter och driftbevis.
