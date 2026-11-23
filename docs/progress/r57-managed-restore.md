# R57 · Återställning från hanterad Supabase-backup

Den här övningen återställer en fysisk säkerhetskopia från ett särskilt Supabase-projekt med syntetiska data till ett nytt, separat projekt. Den verifierar vilken återställningspunkt som användes, migrationsjournalen och kontoavgränsningen i laddschemat innan någon arbetare ansluts. [Lokalt återläsningsprov](r57-postgres-restore.md)

## Inventering den 23 november 2026

Det enda Flexexa-projekt som syntes i den anslutna Supabase-organisationen var `flexexa-dev` (`zhgwlvmtvwjftyjmgljw`). Det rapporterade `ACTIVE_HEALTHY` i `eu-north-1` med Supabase-databasversion `17.6.1.166`. Organisationen har Pro-plan. Katalogkontrollen såg Supabase Vault, inga installerade `pg_cron`, `pg_net`, `wrappers` eller `http`, samt noll externa databasservrar och replikeringsprenumerationer. Faktiska backupdatum och PITR-intervall gick inte att verifiera via den tillgängliga kopplingen. Ingen säkerhetskopia återställdes. [Projektstatus](https://supabase.com/dashboard/project/zhgwlvmtvwjftyjmgljw) · [Backupöversikt](https://supabase.com/dashboard/project/zhgwlvmtvwjftyjmgljw/database/backups/scheduled)

Supabase kräver betald plan och fysiska säkerhetskopior för återställning till nytt projekt. PITR är ett separat tillägg. En fysisk kopia omfattar hela databasen, inklusive Auth och Vaults krypteringsnyckel. Kopierade externa jobb kan börja köras direkt när projektet blir tillgängligt. Använd därför en särskild källa med enbart syntetiska data, utan externa jobb, webhooks, kopplingar eller produktionshemligheter. `flexexa-dev` är den verifierade delade miljön och ingår inte som övningskälla. [Återställning till nytt projekt](https://supabase.com/docs/guides/platform/clone-project) · [Supabase Backups](https://supabase.com/docs/guides/platform/backups)

## Förbered källa och mätpunkter

1. Använd ett godkänt, fristående Supabase-projekt för syntetiska data i `eu-north-1`. Verifiera projektets namn, ref, rätt region, kostnad och vilka som får läsa övningen. Lämna applikationer, arbetare, repliker och webhooks frånkopplade. Kör från en dator som når projektets direkta databasadress. [Supabase-anslutningar](https://supabase.com/docs/guides/database/connecting-to-postgres)
2. Använd två separata poster i en åtkomstskyddad `pg_service.conf`, `r57-source` och senare `r57-restored`. Sätt korrekt roll, Supabases CA och uppgifter från respektive projekts **Connect**. Lägg lösenord i en fil med `0600` för libpq eller i projektets godkända hemlighetshantering. Installera `psql`, `curl`, `jq`, `sha256sum`, Node 24 och låsta beroenden för den granskade laddrevisionen.
3. Sätt `R57_SOURCE_REF` till den syntetiska källans ref. Om källan är tom, kör ordinarie migrering från [laddbackendens checkout](https://github.com/heke99/charging-subscription), med `MIGRATION_DATABASE_URL_FILE` riktad mot den syntetiska källan. Kontrollera anslutningsfilens värd och `sslmode=verify-full` innan migrering. Spara vald `git rev-parse HEAD` och följande skrivskyddade rapport. Använd samma revision vid återläst kontroll.

```bash
npm run migrate:check
```

Följande funktioner använder ett uttryckligt projektreferensbundet TLS-värdnamn. De spärrar den delade Flexexa-miljön.

```bash
set -euo pipefail
umask 077
: "${R57_SOURCE_REF:?Ange syntetisk källas Supabase-ref}"

r57_ref() {
  [[ "$1" =~ ^[a-z0-9]{20}$ && "$1" != 'zhgwlvmtvwjftyjmgljw' ]]
}

r57_psql() {
  local ref=$1 service=$2
  shift 2
  r57_ref "$ref" || return 2
  psql -X -v ON_ERROR_STOP=1 \
    "service=$service host=db.$ref.supabase.co dbname=postgres sslmode=verify-full" "$@"
}

r57_backups() {
  r57_ref "$1" || return 2
  : "${SUPABASE_ACCESS_TOKEN:?Ange en token med backups_read}"
  printf 'Authorization: Bearer %s\n' "$SUPABASE_ACCESS_TOKEN" |
    curl --fail --silent --show-error -H @- \
      "https://api.supabase.com/v1/projects/$1/database/backups" |
    jq '{region,pitr_enabled,physical_backup_data,
         backups:[(.backups // [])[] | {id,is_physical_backup,status,inserted_at}]}'
}

r57_backups "$R57_SOURCE_REF"
```

`GET /v1/projects/{ref}/database/backups` kräver OAuth-scope `database:read` eller den finfördelade tokenbehörigheten `backups_read`. Listningen kan även göras under **Database → Backups** i Dashboard. Spara vald backupreferens och UTC-tiden i provunderlaget. För ett PITR-prov ska den valda tiden ligga inom returnerat återställningsintervall. [Management API](https://supabase.com/docs/reference/api/v1-list-all-backups)

Kontrollera att källan saknar externa timerjobb, anropsfunktioner och repliker. Inventeringen ersätter inte kontrollen av källans konfiguration i Dashboard.

```bash
r57_psql "$R57_SOURCE_REF" r57-source <<'SQL'
SELECT extname FROM pg_extension
WHERE extname IN ('pg_cron','pg_net','wrappers','http','postgres_fdw','dblink');
SELECT count(*) AS foreign_servers FROM pg_foreign_server;
SELECT count(*) AS subscriptions FROM pg_subscription;
SQL
```

Granska eventuella träffar före fysisk kloning. Skapa sedan två syntetiska företag med varsitt fordon och en markör som källans migreringsadministratör. Använd en ny källa för ett nytt prov. SQL avbryts om provschemat eller de fasta ID:n redan finns.

```bash
r57_psql "$R57_SOURCE_REF" r57-source <<'SQL'
BEGIN;
CREATE SCHEMA r57_restore_probe;
REVOKE ALL ON SCHEMA r57_restore_probe FROM PUBLIC;
CREATE TABLE r57_restore_probe.markers (
  phase text PRIMARY KEY CHECK (phase IN ('before', 'after')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO charging_subscription.principals(id) VALUES
  ('57000000-0000-4000-8000-000000000001'), ('57000000-0000-4000-8000-000000000002');
INSERT INTO charging_subscription.accounts(id,kind,name) VALUES
  ('57000000-0000-4000-8000-000000000011','business','R57 recovery A'),
  ('57000000-0000-4000-8000-000000000012','business','R57 recovery B');
INSERT INTO charging_subscription.memberships(account_id,principal_id,role) VALUES
  ('57000000-0000-4000-8000-000000000011','57000000-0000-4000-8000-000000000001','owner'),
  ('57000000-0000-4000-8000-000000000012','57000000-0000-4000-8000-000000000002','owner');
INSERT INTO charging_subscription.vehicles(id,account_id,country,plate) VALUES
  ('57000000-0000-4000-8000-000000000021','57000000-0000-4000-8000-000000000011','SE','R57A'),
  ('57000000-0000-4000-8000-000000000022','57000000-0000-4000-8000-000000000012','SE','R57B');
INSERT INTO r57_restore_probe.markers(phase) VALUES ('before') RETURNING *;
COMMIT;
SELECT clock_timestamp() AS before_commit_confirmed_at;
SQL

r57_journal() {
  r57_psql "$1" "$2" -qAt -c \
    'COPY (SELECT name,sha256 FROM charging_migrations.history ORDER BY name) TO STDOUT WITH CSV' |
    sha256sum | cut -d' ' -f1
}

r57_journal "$R57_SOURCE_REF" r57-source > r57-source-journal.sha256
```

Välj en avslutad fysisk backup där återställningspunkten är efter den första markörens commit, eller en UTC-tid inom PITR-fönstret efter den bekräftade committiden. Kontrollera att backupen eller PITR-tiden verkligen finns innan nästa markör skrivs. Anteckna den valda återställningspunkten. Skriv sedan en markör som ska saknas efter återställningen.

```bash
r57_psql "$R57_SOURCE_REF" r57-source -c \
  "INSERT INTO r57_restore_probe.markers(phase) VALUES ('after') RETURNING *"
```

## Återställ till separat projekt och kontrollera

1. Öppna **Database → Backups → Restore to a New Project** på den syntetiska källan. Välj den antecknade backupen eller PITR-tiden, granska priset och starta kloningen till ett nytt projekt, exempelvis `flexexa-r57-restore-2026-11-23`. Anteckna UTC-tid för start, projektets nya ref och när det blev tillgängligt. Dashboardens flöde för återställning till samma projekt hör inte till provet. [Supabase Restore to a New Project](https://supabase.com/docs/guides/platform/clone-project)
2. Sätt `R57_RESTORED_REF`, skapa tjänsteposten `r57-restored` och verifiera separat värd och TLS. Anpassade databasroller kan behöva nya lösenord. Återanvänd inga produktionsnycklar. [Backupomfattning](https://supabase.com/docs/guides/platform/backups)
3. Kör följande kontroller före påslag av någon integration. Båda markörerna ska finnas i källan, enbart `before` i kopian. Journalens hash ska matcha, och `charging_api` ska kunna läsa den egna men ingen främmande fordonsrad.

```bash
: "${R57_RESTORED_REF:?Ange det nya projektets Supabase-ref}"
r57_ref "$R57_RESTORED_REF"
test "$R57_RESTORED_REF" != "$R57_SOURCE_REF"
test "$(r57_psql "$R57_SOURCE_REF" r57-source -qAt -c \
  'SELECT string_agg(phase,chr(44) ORDER BY phase) FROM r57_restore_probe.markers')" = 'after,before'
test "$(r57_psql "$R57_RESTORED_REF" r57-restored -qAt -c \
  'SELECT string_agg(phase,chr(44) ORDER BY phase) FROM r57_restore_probe.markers')" = 'before'
r57_journal "$R57_RESTORED_REF" r57-restored > r57-restored-journal.sha256
cmp r57-source-journal.sha256 r57-restored-journal.sha256

result=$(r57_psql "$R57_RESTORED_REF" r57-restored -qAt <<'SQL'
BEGIN READ ONLY;
SET LOCAL ROLE charging_api;
SET LOCAL charging.principal = '57000000-0000-4000-8000-000000000001';
SET LOCAL charging.account = '57000000-0000-4000-8000-000000000011';
SET LOCAL charging.role = 'owner';
SELECT count(*) FILTER (WHERE plate='R57A'),count(*) FILTER (WHERE plate='R57B')
FROM charging_subscription.vehicles;
ROLLBACK;
SQL
)
test "$result" = '1|0'
date -u '+Verifierad %Y-%m-%dT%H:%M:%SZ'
```

4. Mät provets återställningstid från bekräftad start till sista verifierade kontroll och redovisa separat när projektet blev nåbart. Redovisa återställningspunkten och de två markörernas tider. Markörerna avgränsar vilken data som återställts i provet och ger underlag för återställningspunkten. De mäter inte all potentiell dataförlust i drift. Spara endast syntetiska ID:n, backupreferens, tidpunkter, journalhash och kontrollutfall. Tillämpa den godkända städningen på just övningsprojekten efter sparad verifiering.

Exemplens Bash-syntax, migreringskontroll, provdata, journalhash och kontoavgränsning har verifierats i disponibel lokal PostgreSQL 18. Arbetsgången för återställning till nytt projekt är kontrollerad mot Supabases dokumentation. Själva hanterade återställningen återstår.

## Externa beroenden före återupptagning

Storage-objekt, Auth-inställningar och API-nycklar, Edge Functions, Realtime, integrationer och vissa projektinställningar hanteras separat. Tills respektive beroende är återställt och tidigare externa effekter har stämts av hålls automatiska utskick, avräkning och styrning frånkopplade i kopian. Det lokala processprovet under [R57 återläsning](r57-postgres-restore.md) verifierar separat att en simulerad leverantörsprocess kan startas om och att en redan registrerad effekt återläses utan nytt laddkommando. Det hanterade provet ovan registrerar databasåterställning och avgränsning. Ett sammanhängande driftprov kräver separat bevis för återställda externa beroenden. [Kopierade inställningar och undantag](https://supabase.com/docs/guides/platform/clone-project)
