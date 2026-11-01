# Projektkontext

Datum: 2026-11-01. Repo: heke99/flexexa. Marknad: Sverige. Domän: flexexa.com.

## Dokumentkarta och auktoritet

- [Aktuell masterplan](FLEXEXA_MASTERPLAN_2026-11-01.md): laddabonnemang, gemensam webb/PWA, ett projekt utan monorepo och krav FX-001–016.
- [V1-baslinje](../FLEXEXA_MASTER_BUILD_PROMPT_V1.md): bevarade långsiktiga energi-/marknadskrav. Den nya planens uttryckliga strukturändringar har företräde.
- [Beslut](DECISIONS.md), [checkpoint](PROJECT_STATE.md), [arbetslogg](work/2026-11-01-masterplan.md).
- [Byggstandard](ENGINEERING_STANDARD.md), antagen Engineering Startkit 3.0.0.
- [Verifieringsarbetssätt](CI_INTEGRATION.md). Den importerade standardens generella kommandoförslag är inte nya exekverbara app-scripts.
- Befintligt docs/progress/masterplan-coverage.json fortsätter spåra V1. Ny plan ersätter inte dess otestade punkter med godkända.

## Bekräftat

Användaren har beslutat ett vanligt projekt/repo, ingen monorepo, en sammanhängande app för konsument och partner. PWA är initial mobilkanal; nativebutiksdistribution är inte beslutad. En Supabase-affärsdatabas per miljö. Tidskritisk styrning fungerar oberoende av frontendprocessen från samma projektkod.

Supabase flexexa-dev: zhgwlvmtvwjftyjmgljw, eu-north-1. Projekt- och public-tabellmetadata kunde läsas 2026-11-01. RLS aktiverat på listade tabeller är inte ett semantiskt policytest. Inga DB-skrivningar gjorda för planuppdraget.

Main vid uppdragsstart: df59d718869b152b72c15723f871c1078b0380ae. Vid uppdragsstart använde koden apps/web och pnpm/Turbo. Webb har därefter flyttats till ett rotprojekt. Foundation-grenen innehåller mer backendkod; kontrollerat sammanförande återstår. Planen ändrar inte befintliga versionslås eller driftsinställningar i denna leverans.

## Profiler och skills

Tillämpliga profiler: Next.js/Supabase, organisationsisolering/white-label, abonnemang/betalning, PWA samt datautbyte. AI senarelagt tills konkret behov finns; produktägare/implementerande utvecklare återbesöker inför första AI-funktion. Native-distribution och offlinebetalning inte del av första omfattningen.

Aktiverat för planuppdraget: Supabase-skill och repo-overlay för läsåtkomst/kanonisk modell; Library-skill läst för filrutiner; personal-context i föregående kartläggning; repo-verifiering och upstream verification för avgränsade leveranspåståenden. UI-, AWS-, Turborepo- och betalningsimplementation är avsiktligt inte körda; deras skills används när motsvarande kod/drift berörs. Inga nya skills installeras genom startkitet.

## Observerade befintliga kommandon, rotprojekt

| Kommando | Omfattning och förutsättning |
|---|---|
| pnpm lint | Gemensam webb, låst installation krävs |
| pnpm typecheck | Befintlig webb, låst installation krävs |
| pnpm test | Befintliga webb-/kvalitetstester, installation krävs |
| pnpm build | Next.js i rotprojektet |
| node scripts/quality/masterplan-report.mjs --check | V1 coverage-integritet; Node-miljö; inte funktionsbevis |
| node scripts/quality/masterplan-report.mjs --require-ready | Ska neka hela planens färdigstatus när krav saknar evidens |
| python3 tools/engineering/check_standard.py --project . --mode project | Statisk standardstruktur och dokumentlänkar |
| git diff --check | Whitespace/felmarkörer i ändringen |

Runtimekrav hämtas från package.json/lockfil innan implementation. Faktiskt körda kontroller finns i PROJECT_STATE. Produktionsdrift, branchskydd, återställning och externa integrationsavtal är inte verifierade i detta uppdrag.

Kontakt: info@flexexa.com. Användaren har angivit Trafexa Nordic som ansvarig verksamhet. Organisationsnummer/adress är inte bekräftade.
