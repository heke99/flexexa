# Beslut

| ID | Datum | Status | Beslut och skäl |
|---|---|---|---|
| ADR-20261101-01 | 2026-11-01 | Beslutat av användaren, genomförande planerat | Ett projekt/repo utan monorepo. Webb, kundapp, partner och admin är vyer i samma produkt. Ersätter V1:s monorepostruktur, inte dess domänkrav. |
| ADR-20261101-02 | 2026-11-01 | Beslutad plan | Gemensam Supabase-affärsdatabas per miljö; bevara befintliga kanoniska modeller och tenantgränser. Ingen ny DB provisionerad. |
| ADR-20261101-03 | 2026-11-01 | Beslutad plan | En gemensam mobilanpassad PWA först; native-distribution separat framtida beslut. |
| ADR-20261101-04 | 2026-11-01 | Bevarad arkitektur | Styrbackend arbetar oberoende av frontend. Webb och workers från samma projektkod; AWS-/telemetrigänser bevaras. |
| ADR-20261101-05 | 2026-11-01 | Beslutad produktavgränsning | Hemersättning omfattar kvalificerad laddenergi/elhandelspris; inga nätkostnader. Flex-/Gridex-intäkter räknas separat från laddproduktens bärkraft. |
| ADR-20261101-06 | 2026-11-01 | Infört i dokumentgren | Engineering Startkit 3.0.0 används utan blind överskrivning. Befintlig AGENTS kompletteras; standarden ändrar inga driftmandat. |

Detaljer och öppna affärsbeslut finns i [masterplanen](FLEXEXA_MASTERPLAN_2026-11-01.md). Arbetsnamnet Charge är ett namnförslag. 1 600 kr/månad är arbetsscenario och 2,80 kr/kWh inklusive moms ett kalkylantagande som behöver bindas till verkligt partneravtal före publicering.
