# R57 · Återställning av ladddata i PostgreSQL

Det lokala provet följer en uppgradering från äldre procentmål till stöd för mätta kWh och återställning av en redan utförd simulerad start med förlorad kvittens. Det använder abonnemangsrepots ordinarie migreringskommando, HTTP-rutter, planeringsprocess och kommandoprocess. [Reviderad byggordning](../FLEXEXA_REVISED_BUILD_ORDER_2026-11-22.md) · [Kapacitetsverifiering](capacity-verification.md)

## Kör provet

Förutsättningar är Linux som vanlig användare, Node 24, PostgreSQL 18 med `initdb` och `pg_ctl`, samt matchande huvudversion av `pg_dump` och `pg_restore`. Checka ut laddbackenden med migration 044 och 047. Installera dess låsta npm-beroenden samt Python-beroendena från `workers/fleet-planner/requirements.lock.txt`. Ange vid behov `R57_POSTGRES_BIN` och `R57_POSTGRES_CLIENT_BIN` som kataloger för verktygen. Provet skapar en ny datakatalog under `/tmp`, använder en privat Unix-socket och raderar de disponibla testdatabaserna och arkivet efteråt. API:t använder ett lokalt testkonto, ett fiktivt elpris och en simulator i samma provprocess.

```sh
node scripts/quality/r57-postgres-restore.mjs /sökväg/till/charging-subscription
```

| Provsteg | Kontroll |
| --- | --- |
| Äldre underlag | Lägg in 12 000 fordon, sparade procentmål och laddstatus för två testföretag samt 24 000 avslutade laddsessioner från två månader. Kontrollera historikens omfattning och kontrollsummor. |
| Avbrott | Håll ett läslås på fordonsprofilerna. Kör ordinarie migreringskommando och observera låskön i PostgreSQL. Läs fordonstabellen parallellt och mät tidsgränsen för en ny profilläsning bakom migreringen. Avsluta migreringsprocessen medan låset fortfarande väntar. Verifiera att schemaändringen och dess journalpost saknas. |
| Återupptagning | Frigör låset och kör ordinarie migreringskommando på nytt. Verifiera journalens checksummor, bestående procentmål och sessionshistorik. Upprepa samma kommando och verifiera oförändrad journal. |
| Återläsning | Skapa och starta en kWh-plan via HTTP och ordinarie processer. Låt simulatorn skriva effekten och tappa kvittensen. Kör `pg_dump` före avstämning och `pg_restore` till en separat testdatabas i samma isolerade kluster. Verifiera journalen och data samt läsning som `charging_api` för ett företag med det andra företagets rader skyddade. |
| Avstämning | Läs det osäkra kommandot via återställd databas. Låt den ordinarie kommandoprocessen stämma av mot simulatorns tidigare effekt. Kontrollera att kontot ser 1 000 Wh och noll effekt efter kvartens slut samt att nästa körning är ledig. Exekveringsförsök och simulerad effekt ska båda vara exakt ett. |

## Lokalt resultat den 22 november 2026

Körningen passerade med laddbackenden `46cf79002b628940067c0bd389cd101578a23e7e`, Node 24.19.0, PostgreSQL 18.6, `pg_dump` och `pg_restore` 18.7 samt OR-Tools 9.15.6755. Backendrepots runtimekällor och migreringar matchade revisionen vid kontroll.

| Mätpunkt | Observerat |
| --- | --- |
| Transaktionsavbrott | PostgreSQL väntade på relationslås efter 134 ms. Läsning i den separata fordonstabellen tog 2 ms, medan nästa profilläsning bakom DDL-låset fick `55P03` efter 201 ms. Ingen ny kolumn eller journalpost kvarstod efter avbrottet. |
| Återupptagen migrering | 139 ms. 41 journalposter matchade efter omkörning. Kontrollsummors underlag omfattade samtliga 12 000 äldre profiler och 24 000 sessionsposter och matchade även efter återläsning. |
| Backup och återläsning | 3 673 798 byte på 266 ms. Återläsning tog 618 ms och hela intervallet från start av återläsning till avstämt kommando tog 1 090 ms. `charging_api` såg 6 000 egna och 0 främmande äldre profiler. |
| Redan utförd effekt | Ett exekveringsförsök, en registrerad effekt hos simulatorn och 1 000 Wh återläst via HTTP. Kvittensen skrevs tillbaka på det återställda kommandot. Nästa arbetarkörning hade inget kvar att bearbeta. |

Omprovet på `1bfc939` använde den uppdaterade migreraren och 44 journalposter, inklusive 050. Samma 12 000 fordonsprofiler och 24 000 sessioner stämdes av efter återläsning. Arkivet var 3 684 828 byte, återläsningen tog 598 ms och avstämd effekt fanns efter totalt 1 007 ms från återläsningens start. API-rollen såg 6 000 egna och 0 främmande profiler. Simulatorn registrerade ett exekveringsförsök, en effekt och 1 000 Wh.

Arkivet omfattar källdatabasens logiska databasobjekt och data efter migrering. Målet startar som tom databas med klustrets redan tillgängliga databasroller. Ett driftprov behöver dessutom öva återställning av roller och externa beroenden från en fristående återställningsmiljö samt stämma av verkliga leverantörseffekter innan processer återstartas. Migration 044 arbetar i en PostgreSQL-transaktion och har ingen separat bakgrundsfyllning. Därför gäller avbrottsresultatet transaktionsgräns och låskö. En verklig bakgrundsfyllning, 12 månaders historik, samtidig representativ trafik och beslutade återställningsmål för driften återstår inom R57.

Skill-routing följer repots `verification` och `observability` och byggstandardens avsnitt 11–13. Provet använder lokal Postgres; driftsatt Supabase, tjänstebackuper och återläsning av externa tjänster omfattas av respektive driftprov.
