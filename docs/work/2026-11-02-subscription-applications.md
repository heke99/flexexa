# Elbilsabonnemang och ansökningar

Uppdrag: publik abonnemangssida → validerad icke bindande ansökan → privat Supabase-register och fryst mejljobb → Resend → skyddad kanonisk superadminvy.

Skill-routing: Supabase/Postgres, Next.js, React, verification, browser verification, deployments, env-vars, email-best-practices aktiva. Monorepo/Turbo avsiktligt bortvalt enligt användarbeslut. Inga betalningar, fysisk styrning eller tenant-ägda kundregister ändras.

- Samma projekt, ny /elbilsabonnemang i huvudnavigation; räknare även på startsidan.
- Startvärde 93 är kampanjinställning, inte fabricerade personrader. 907 nya unika ansökningar till första 1000. Nästa grupp därefter, ingen stoppgräns.
- Atomisk platsregistrering och unik normaliserad mejladress. Dubbletter ändrar inte uppgifter/räknare eller skickar nya bekräftelser.
- Privat förvärvsschema, RLS och inga publika tabellrättigheter. Server-RPC kräver hashverifierad serverhemlighet. Ingen service-role-nyckel i Next.js.
- Superadmin hekmat.h@div3rsa.com använder engångslänk via Supabase Auth och Resend. En smal Edge-funktion använder sin befintliga service-roll efter serverautentisering för att skapa enbart ägarens länk. Behörighet kontrolleras mot befintliga platform_memberships + superadminroll; avstängd medlem återaktiveras inte. HttpOnly-session högst 1h. Inga personuppgifter i publika svar.
- Privat uttag paginerat 100, läsning auditerad. Samtycke, erbjudandegrupp och leverantörens mejlreferens synliga.
- Varje bekräftelse får beständig kö, låst claim, återförsök med oförändrad payload/idempotensnyckel och kontrollstatus efter 23h. Vercel cron var tionde minut med Bearer-autentisering. Accepterat av leverantör skiljs från faktisk leverans.
- Avsändare är verifierad info@trafexa.com, tydligt Flexexa via Trafexa Nordic; svar till info@flexexa.com. Flexexa-domänen påstås inte vara mejlautentiserad.
- Separat integritetsinformation och frivilligt erbjudandesamtycke. Automatisk gallring efter 12 månader; nätverkshashbudgetar 2 dagar. Publika räknaren är kumulativ och minskas inte vid gallring. Rättelse/radering hanteras via dataskyddskontakt.
- Officiella Resend-simulatoradressen delivered@resend.dev markeras alltid tekniskt test och påverkar inte kampanjräknaren.

Verifieringsjournal: lint och typkontroll, 82 befintliga tester, produktionsbuild och HTTP/asset-gate passerade. Transaktionella Postgres-tester PASS: plats1000/1001, dubblett, fel hemlighet, ägarroll, avstängd roll, anonym isolering, mejlretry, gammalt claim och 23h-gräns; rollback lämnar inga ansökningar/användare. Tre migrationssteg återspelade i isolerat schema och rollbackade utan fel. Ny inputvalidering har separata tester. Produktionsflöde, leveranskvittens och slutlig browserkontroll uppdateras efter driftsättning.

Detta är ansökningsflödet. Kommersiell prislista, bindande abonnemang, partneranslutningar, betalning och fysisk laddning är inte verifierade av dessa tester.

Säkerhetsrådgivning: nya privata tabeller har avsiktlig default-deny utan klientpolicies. RPC:ns explicita anon/authenticated EXECUTE ger två rådgivningsvarningar; varje anrop verifierar 256-bitars serverkapabilitet före operation och admin kräver dessutom aktuell JWT/roll. Ingen hemlighet finns i klientbundle. Negativa åtkomsttester passerade. Se Supabase database-linter 0028/0029 för bakgrund; detta är ett medvetet server-API, inte generell anonym DB-åtkomst.

Produktionsverifiering 2026-11-02: deployment dpl_HbCSWrH6P1DatT68oUUnzrUHhfY9 READY på www.flexexa.com, källcommit60ebe9027c61f8e905540b24e97fd1d48c295bfe. Browser: formulär skickat med officiell Resend-simulator, tackmeddelande visat, räknaren kvar93/907. DB: is_test=true, position=null, email_state=sent, ett försök. Resend01a19bd9-49af-7850-a53f-c50902cb1466 rapporterad delivered.

Produktions-API: obehörig admin401, fel Origin403, ägarens Supabase-engångstoken verifierad, aktiv kanonisk superadminroll och skyddad listning200, utloggning åter401, återanvänd token401. Worker utan Bearer401, med giltig hemlighet200. Ny oanvänd inloggningslänk skickad till godkänd ägaradress; Resend01a19bdc-1976-762d-b9fb-3e53ae365c7c rapporterad delivered. Ingen inloggningshemlighet sparas i repo eller rapport.

Slutlig lokal testsvit84/84; lint, typkontroll, build och HTTP-gate passerade. Privat förvärvsregister är plattformsägt; två-tenant-affärsdata ändras inte och ingen tenantkoppling härleds från frontend.
