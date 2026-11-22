# Checkpoint 2026-11-22

Den [reviderade byggordningen](FLEXEXA_REVISED_BUILD_ORDER_2026-11-22.md) gäller för arbetspaketen nedan. Produktändringar integreras från `charging-subscription` main `c26766f`. Projektstatus, kapacitetsprofil och samlad verifiering utgår från `flexexa` main `37aec07`. Lokala integrationsgrenar heter `codex/flexexa-revised-plan` i respektive repo. [Baslinje och driftevidens](progress/revised-baseline.md)

| Krav | Ansvar och leverans | Arbetsläge | Nästa verifiering |
| --- | --- | --- | --- |
| Steg 0 | Baslinje, aktuell webb, Actions, 93 fynd och Engineering Startkit | Källrevisioner och Vercel-build verifierade | Hämta Startkit v3.1.0 och matcha aktuell AWS- och databasmiljö |
| R42–R43 | Ekonomi, mätunderlag och avtalsstyrt tillägg | Lokal avräkning och attest bunden till granskat prisunderlag | Avstämning i betalningsmiljö med aktuella avtal och verkliga mätbevis |
| R44, R48 | Roamingkostnad, CDR och fordonskoppling | Lokal workerimport med granskningsstatus och sena revisioner | Verifiera faktisk operatörsdata, kundvisning och marginalrapport |
| R45, R56 | API, webb, mobil och företagsdelegering | Lokal behörighetskontroll, webbresan och ett beständigt partnerflöde för slutförd plan | Partner-OAuth och utgående webhook, signerad app på fysisk enhet samt blandad last |
| R46, R54, R58 | Laddintegration, [laddpilot](progress/charging-pilot.md) | Lokala prov av start, paus, återupptagning och avstämning av tappad kvittens | Kör samma sekvens på avtalad utrustning med lokal reserv och uppmätt kWh. Prova längre avbrott under last. |
| R47, R50 | Rewards och tidsbundna marknadsrelationer | Simulatorn bevarar historisk mottagare och tillämpar ny relation från sitt giltighetsdatum | Verifiera marknadsavtal, mottagare, verklig mätning och partneravräkning |
| R49 | Gridex och återhämtning av köp och offert | Lokal portal och API verifierade för testorder och bevarad offerthistorik | Verifiera separata avtalsutfall i avsedd partner- och betalningsmiljö |
| R51–R58 | Kapacitetsprofil och [belastningsprov](progress/capacity-verification.md) | Testdata samt avgränsade lokala HTTP-prov med PostgreSQL | Kör hela profilen med ordinarie flöden och testroller i produktionslik miljö |
| R52 | Asynkrona beräkningsförslag per gemensam effektgräns | Lokalt HTTP-/kö-/solverprov inklusive täta resultat med 12 000 bilar | Verifiera fasgränser, faktisk platskoppling, kvoter och samlad belastning |
| Steg 2 | [Fordonskatalog och telemetri](progress/vehicle-pilot.md) | Två normaliserade katalogposter reproducerade från licensierad EEA-källa | Enode Sandbox och verifiering med BMW 330e 2023 och utsedd BEV |

Releasebedömningen är röd. Fysisk styrning, partneravräkning, betalning och full kapacitetsacceptans har öppna grindar. Arbetspaketen ovan avser den lokala integrationsversionen. [Kravmatris och bevis](work/2026-11-22-revised-build.md)

# Senaste tillägg: 2026-11-02

Ansökningsflöde för elbilsabonnemang implementerat. Supabase-migrationer och smal ägarautentiseringsfunktion driftsatta. Superadmin: hekmat.h@div3rsa.com, verifierad e-postinloggning och befintlig kanonisk plattformsroll. Produktionspublicering och leveranskontroll följs i work/2026-11-02-subscription-applications.md. Nedanstående äldre checkpoint är historik.

# Aktuell checkpoint

Datum: 2026-11-01. Uppdrag: masterplan och införande av Engineering Startkit 3.0.0.
Branch: docs/charge-masterplan-startkit-20261101. Bas: main df59d718869b152b72c15723f871c1078b0380ae.

## Läge

- Masterplan, kontext, beslut och startkit: implementerat i dokumentgren.
- Supabase flexexa-dev projekt-/public-tabellmetadata: verifierad läsåtkomst 2026-11-01.
- Webbprojektets rotflytt: implementerad och lokalt byggverifierad. Foundation-backendens infogning kvarstår.
- Webb och appförhandsvisning: implementerade; detaljer i work/2026-11-01-web-foundation.md.
- Integritet, cookies och webbplatsvillkor: implementerade för informationsversionen; bolagsdetaljer återstår.
- Laddabonnemang, betalningar, hemersättning och laddpartner: planerat, inte verifierat.
- Dokumentändringars driftläge: ej driftsatt; ingen databas-/infrastrukturändring.

## Kontrolljournal

Bootstrap dry-run och apply körda. Befintlig AGENTS bevarad och kompletterad; originalzip bevarad.
V1-baslinjen bevaras byteidentisk för befintligt coverage-register. Ett försök att lägga in
hänvisning i V1 gav PLAN_SOURCE_DRIFT; ändringen återtogs. Ny auktoritet hänvisas via AGENTS.
Slutlig kontroll: check_standard --mode project passerade med 0 fel och 1 generell varning om
AGENTS.engineering.md. Aktiv AGENTS.md hänvisar uttryckligen till den; automatisk laddning
i andra agentmiljöer påstås inte verifierad. V1 plan:check passerade med coverage_integrity=true;
recorded_plan_ready=false (förväntat, ingen produktfärdigstatus). git diff --check passerade.
Webbleverans: lint, typkontroll, 82 tester, produktionsbuild och HTTP-smoke passerade lokalt.
Produktionsbrowser-QA för navigation/laddförhandsvisning och mobil layout genomförd.
Ingen migration, RLS-funktionstest, betalning eller fysisk laddning körd.

## Nästa exakta handling

Inventera phase/0-foundation mot main och dev-databasens fullständiga schema/migrationshistorik.
Registrera kanonisk återanvändning och verifieringsbaslinje. Fortsätt därefter identitets-/backendkoppling enligt
[masterplanen](FLEXEXA_MASTERPLAN_2026-11-01.md), utan nya konkurrerande modeller.

## Kvarstående frågor

Avtalspart, slutliga abonnemangsvillkor/moms, betalningsleverantör, ersättningsprisets komponenter,
mätkrav, publik laddpartner och BSP-pilot kräver underlag innan berörd kommersiell aktivering.
Läsåtkomst verifierar inte DB-skrivåtkomst. Staging/produktion och aktuell AWS-drift är inte verifierade.
