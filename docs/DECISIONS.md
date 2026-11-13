# Beslut

## Beslut 2026-11-13 — uppsägning och nya konsumentvillkor

Ägaren har beslutat två månaders bindningstid per förlängning och en kalendermånads uppsägningstid. Begäran får registreras under bindningstiden; tjänst och betalningsskyldighet fortsätter till första bindningsperiodslut efter uppsägningstiden. Ny v5-version i portalrepot bevarar tidigare accepterade versioner. Registreringsnummer ska identifiera avtalet i ordervy och mottagningsbevis. Lagstadgad ånger kan inte automatiskt tas bort efter en enskild laddning; användning och ersättning prövas enligt distansavtalslagen 2 kap. 10–15 §§. Webbtexten återger dessa regler och länkar till v5-PDF. Kommersiella köp är fortsatt stängda.

## Beslut 2026-11-12 — produktbilaga för privatköp

Ägaren har fastställt produktbilagans regler. Fullständig version och maskinläsbar policy finns i portalrepot `heke99/charging-subscription`: `docs/web/private-terms-2026-11-12-v4-sv.md` och `docs/web/private-contract-policy-v4.json`.

- Publik täckning får visas först för stationer med aktivt partneravtal och verifierad start, stopp och kWh-återrapportering. Ingen stationslista är ännu godkänd.
- Hemmaladdare/integrationer kräver verifierade kWh per session och koppling till abonnemangets bil. Ingen modellista är ännu godkänd.
- Hemersättning = laddboxens verifierade kWh × faktiskt rörligt elhandelspris inklusive moms för samma laddning. Kvartspris använder respektive kvart, rörligt månadspris fakturans rörliga kWh-pris för månaden och portföljpris det tillämpliga fakturerade rörliga kWh-priset. Rörliga kWh-påslag ingår; fasta avgifter, elnätsavgifter, effekttariffer och energiskatt undantas. Inget extra förlustpåslag. Ofullständigt underlag håller ersättningen väntande.
- Separat kreditrad på Flexexafakturan, överskott till nästa faktura och kvarvarande saldo utbetalt vid slutavräkning. Hemersättning och energitillägg redovisas separat. Den beslutade tilläggströskeln 1,35 kr/kWh exklusive moms är oförändrad.

Beslutade villkor är inte bevis för implementerad avräkning eller verifierade integrationer. Köp förblir spärrade. Detta ersätter äldre öppna beslut om ersättningskomponenter, förlustregel och utbetalning/kvittning; övrig historik nedan bevaras.

| ID | Datum | Status | Beslut och skäl |
|---|---|---|---|
| ADR-20261101-01 | 2026-11-01 | Beslutat av användaren, genomförande planerat | Ett projekt/repo utan monorepo. Webb, kundapp, partner och admin är vyer i samma produkt. Ersätter V1:s monorepostruktur, inte dess domänkrav. |
| ADR-20261101-02 | 2026-11-01 | Beslutad plan | Gemensam Supabase-affärsdatabas per miljö; bevara befintliga kanoniska modeller och tenantgränser. Ingen ny DB provisionerad. |
| ADR-20261101-03 | 2026-11-01 | Beslutad plan | En gemensam mobilanpassad PWA först; native-distribution separat framtida beslut. |
| ADR-20261101-04 | 2026-11-01 | Bevarad arkitektur | Styrbackend arbetar oberoende av frontend. Webb och workers från samma projektkod; AWS-/telemetrigänser bevaras. |
| ADR-20261101-05 | 2026-11-01 | Beslutad produktavgränsning | Hemersättning omfattar kvalificerad laddenergi/elhandelspris; inga nätkostnader. Flex-/Gridex-intäkter räknas separat från laddproduktens bärkraft. |
| ADR-20261101-06 | 2026-11-01 | Infört i dokumentgren | Engineering Startkit 3.0.0 används utan blind överskrivning. Befintlig AGENTS kompletteras; standarden ändrar inga driftmandat. |

Detaljer och öppna affärsbeslut finns i [masterplanen](FLEXEXA_MASTERPLAN_2026-11-01.md). Arbetsnamnet Charge är ett namnförslag. 1 600 kr/månad är arbetsscenario och 2,80 kr/kWh inklusive moms ett kalkylantagande som behöver bindas till verkligt partneravtal före publicering.
