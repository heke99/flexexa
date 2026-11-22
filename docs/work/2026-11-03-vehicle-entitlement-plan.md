# Fordonsbundet abonnemang och API-plan

Datum: 2026-11-03. Repo: heke99/flexexa. Branch: docs/charge-masterplan-startkit-20261101. Lokal kodbas vid start: b9b34e8. Uppdrag: granska och utöka masterplanen så att annan bil inte kan finansieras med samma abonnemang hemma/publikt samt planera API-stödet.

## Omfattning och skill-routing

Plan-/dokumentändring. Aktiva: cloud runtime-instruktioner, Supabase och repo-overlay för kanonisk modell/tenantgräns, verification-overlay för avgränsade evidensanspråk. Lästa standardområden: domänägarskap, data, transaktioner, API/integrationer, integritet och kontext. Profiler: abonnemang, organisationsisolering, mobil/API/datautbyte. UI-, drift-, betalnings- och migrationsimplementation avsiktligt inte utförd. Inga nya skills eller beroenden installerade. Ingen delegering.

## Granskningsfynd

- FV-01: Ursprunglig plan hade registrering av bil men ingen sammanhängande kedja från verifierad fysisk bil till betald publik session/hemersättning. Registreringsnummer eller manuellt VIN bevisar inte närvaro vid laddaren.
- FV-02: OCPI-token och auktorisering är inte generellt VIN-bevis. OCPP-version eller Autocharge i partnerns egen app bevisar inte att vår roamingkedja får fordonskontroll. Primärkällor och begränsningar finns i masterplan §20.
- FV-03: Box-ID och boxenergi kan avse annan bil. OEM-data kan vara gammal, sakna nödvändiga scopes eller omfatta flera bilar. Enkla samtidighets-/positionskontroller är signaler, inte fullständig garanti.
- FV-04: Lokal src/app/api och src/domains innehåller ansökningar/admin; driftsatt portal är inte bevis för en färdig ladd-/fordonskontroll-API. V1 §§66–68 innehåller långsiktiga API-/mandatkrav som den nya planen ska komplettera, inte ersätta.

## Genomförd planändring

Masterplan version2.1: §§9.1–9.3 fordonsrätt/bevis/samtidighet; §10.1 hemkvalificering; §§11.1–11.4 publika kontrollprofiler, granskning, leverantörsmatris och API-kontrakt; §17.1 tester; §20 primärkällor. Integrerat med datamodell, admin, leveransfaser A och D–H samt öppna affärs-/integrationsbeslut. Nya planerade krav FX-017–026 i befintligt register. AGENTS/kontextens kravintervall och besluts-/checkpointdokument synkroniserade. V1 och dess coverage-ledger bevarade.

Planen anger en verifierad bil per grundabonnemang, kontrollerade bilbyten/ersättningsbil, ingen automatisk ersättning för annan bil, hantering av otillräckliga data, gemensamma serverbeslut och avgränsade manuella undantag. Ingen dold kWh-gräns och ingen garanti om fullständigt fuskstopp. Kompatibilitet, toleranser, offlinevillkor, dataskydd och kommersiella undantag beslutas/verifieras före beroende aktivering.

## Verifiering och kvarvarande arbete

Dokumentgranskning mot användaruppdrag, aktuell lokal routestruktur, V1:s API-kapitel och primärkällor. Körda dokumentkontroller fylls nedan efter faktiskt utfall. Ingen appbuild, DB-migration, RLS-körning, ny partneranslutning eller fysisk laddning genomförs för denna dokumentändring. FX-017–026 kvarstår planerade.

Nästa konkreta byggsteg: inventera verkliga kanoniska modeller/adaptrar i foundation, samla kandidatpartners API-/testunderlag och fyll kompatibilitetsmatrisen; välj en hemmalösning och en publik partner för fysisk rätt-/fel-bil-pilot. Inga nya betalda leverantörstjänster beställda.

Körda kontroller 2026-11-03: `python tools/engineering/check_standard.py --project . --mode project` gav 0 fel och 1 befintlig generell varning om AGENTS.engineering.md (aktiv AGENTS hänvisar redan till den). `node scripts/quality/masterplan-report.mjs --check` gav coverage_integrity=true, 88 V1-avsnitt, 14 faser och 3701 källpunkter; recorded_plan_ready=false är förväntat och är inget nytt funktionsfel. `git diff --check` passerade. Riktad kravgranskning bekräftade FX-001–016 bevarade, FX-017–026 exakt en kravrad vardera, nya underrubriker unika och V1/coverage-ledger oförändrade.
