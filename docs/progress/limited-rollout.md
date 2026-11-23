# Begränsad utrullning

Första omgången omfattar högst ett godkänt företag per produktkombination och en verklig partnerapp. Börja i avsedd testmiljö. Registrera godkänt företag, verifierad ägare, miljö, kodrevision, produktkombination, tidsfönster och kontakt för eventuellt stopp. Första provet omfattar laddabonnemang, energioptimering och kombinationen av båda. Håll effektstyrning, marknadsleverans och kunddebitering utanför detta åtkomstprov.

1. Läs behörighetsstatus via `GET /v1/platform/product-access/status`. Om företagskontot saknas kan plattformsadministratören skapa det för den verifierade ägaren via `POST /v1/platform/product-access/companies`. Spara konto-ID och läs dess befintliga rättigheter innan tilldelning.
2. Tilldela endast pilotens produktnycklar och deras förutsättningar genom `POST /v1/platform/product-access/accounts/{accountId}`. Energioptimering kräver även en aktiv `external_api`-behörighet. Partneråtkomst kräver dessutom registrerad klient och uttryckligt mandat. Kontrollera den faktiska ägarens svar på `GET /v1/accounts/{accountId}/product-access` och motsvarande portalvy. Verifiera att övriga produktvägar stängs och att en användare i ett annat företag nekas åtkomst.
3. Anslut en registrerad partners verkliga OAuth-klient till pilotkontot. Verifiera att ett uttryckligt mandat via `/v1/accounts/{accountId}/partner-consents` begränsar partnern till valda fordon och scopes. Kontrollera ett tillåtet anrop, ett anrop mot fel företag och ett försök utanför beviljat scope. Referensklienten finns i laddbackendens `examples/partner-client.mjs`.
4. Återkalla pilotmandatet och verifiera att nya partneranrop nekas och att tidigare köat arbete inte får ny effekt. Vid fel, återkalla de produkttilldelningar pilotprovet skapade och kontrollera att övriga rättigheter fortfarande fungerar. Spara tid, utfall och korrelations-ID utan token eller personuppgifter.

R57:s hanterade återställningsövning är senarelagd för den begränsade utrullningen. Det pågående dygnsprovet med 12 000 fordon hör till underlaget för breddlansering. Enode och den fysiska laddpiloten är senarelagda. [Beslut](../DECISIONS.md) · [Byggordning](../FLEXEXA_REVISED_BUILD_ORDER_2026-11-22.md)

## Lokal verifiering 2026-11-23

Laddbackend `a9d267a` klarade samtliga tio testfall i `product-access.test.mjs`, `energy-partner.test.mjs` och `energy-partner-contract.test.mjs` med lokal testdatabas och OR-Tools 9.15.6755. Testerna täcker bland annat företagsprovisionering, oberoende produktbehörigheter, delegering mellan företag, OAuth-anspråk, köbearbetning och återkallelse. Verkliga pilotkonton och partnerns OAuth-klient återstår att verifiera i testmiljön.

Det syntetiska provet `test/limited-rollout.test.mjs` i laddbackenden ingår i dess ordinarie testsuite. Det kör tre fiktiva företag genom HTTP med en separat databas i minnet. Provet kontrollerar beroendet till `external_api`, isoleringen mellan företagen, selektiv återkallelse och att testdata städas bort. I laddrevision `44848ce` går även pilotens partnerprov genom referensklienten och det lokala API:t. Klienten kan läsa endast det delade fordonet och nekas vid fel företag, otillåtet scope och återkallat mandat. Samkörningen med produkt- och partnertesterna gav 11 godkända testfall.

## Avläsning av testmiljön 2026-11-23

AWS-stacken `flexexa-energy-sandbox` rapporterade `UPDATE_COMPLETE`. API-task 8 och worker-task 7 pekar på digest `sha256:71f7eacc691a1cda54827afcf19240e2bd74278fd321437796fe75d6a2b1125c`. ECR:s arkivtagg matchar laddbackendens byggjournal för källrevision `fe35c55`. Den lokalt verifierade revisionen `44848ce` behöver provas i staging efter uppdatering. Stagings live- och readiness-anrop gav HTTP 200. Produktadministration utan inloggning gav HTTP 401.

`flexexa-dev` kör PostgreSQL 17.6. Betalningssandboxens migrationsjournal visar 038–055 i `20261122213520` och 056 i `20261123092145`. Den lokala kedjan innehåller även 057–059. I `charging_subscription_sandbox` fanns en aktiv tilldelning för `charging_subscription_sandbox`, inga registrerade partnerklienter och därmed ingen aktiv koppling till Auths OAuth-register. Inför partnerprovet behövs den godkända partnerappens OAuth-klient och ett uttryckligt mandat. Kontrollera därefter att klienten ser det delade fordonet, nekas vid fel företag och scope samt nekas efter återkallelse.

## Kandidat med verifierad laddplats och laddhistorik

Laddbackend `97773e7` kopplar ett pilotföretags konto till kanonisk tenant, kund och plats. Fordonet har en tidsbegränsad koppling till laddpunkt och mätpunkt. Planen begränsas av verifierad tillgänglig laddningseffekt, platsens importgräns och laddpunktens märkeffekt. Köläggning och utskick kontrollerar att kopplingen fortfarande gäller. Provet i PostgreSQL 18 och i lokalt omskrivet sandboxschema begränsade 350 kW till 4,5 kW, spärrade ett redan köat kommando när gränsen ändrades och tillät en ny plan på 2,5 kW. Det separata omstartsprovet verifierade avstämning efter processdöd med ett enda utfört positivt kommando. Den verifierade platsvägen är ett uttryckligt simulatorval. Fysisk effektstyrning behöver en validerad adapter, platsens fasgränser och mätning på utrustningen.

Flexexa-PWA:n `abc5ed3` visar de tio senaste laddsessionerna per konto med status och tidpunkter från ladd-API:t. Ett lokalt prov från PWA via HTTPS och API till PostgreSQL verifierade listning, detalj, avgränsning per abonnemang och nekad åtkomst över kontogränsen. Därutöver passerade 11 Chromiumfall, 122 automatiska kontroller, produktionsbygge och typkontroll. Laddhistoriken använder Commerce-API:ts befintliga sessionsvägar.

Migrering 057–059 finns i sandboxens migrationsjournal under `20261123172331`, och 060 under `20261123172956`. Katalogavläsningen verifierade att de nya tabellerna och platsfunktionen finns i sandboxschemat. De två nya pilottabellerna är tomma och API- och arbetarrollerna saknar direkt skrivbehörighet till platsregistret.

AWS CodeBuild byggde `97773e7` i `flexexa-energy-sandbox-image:fcb994b5-be2b-4b8f-bbe7-69f87ad8ae19`. CloudFormation nådde `UPDATE_COMPLETE`. Båda ECS-utrullningarna nådde `COMPLETED` med en körande och noll väntande tasks. API-task 9 och worker-task 8 rapporterade `HEALTHY` med digest `sha256:06e608b691335b0f275502f9da95cac2d249e0ceffbd8e72a01df397617c8bb7`. Live och readiness gav HTTP 200, oinloggad produktadministration gav 401 och energi-API:ts styrväg gav 404. ECR:s bildskanning rapporterade 0 kritiska, 1 hög, 10 medelhöga och 4 låga fynd. PWA-ändringen publicerades separat i en SSO-skyddad preview på exakt revision `abc5ed3`. Vercel rapporterade `READY` och byggloggen listar både sessionslistan och sessionsdetaljen. Ett anonymt anrop till sessionslistan omdirigerades till Vercel SSO. Det inloggade flödet är verifierat lokalt. GitHub registrerade inga Actions-körningar för previewgrenen. [Vercel-preview](https://flexexa-k4izsn0yb-div3rsa.vercel.app/app/konto/oversikt)

Den ordinarie kandidatsviten gav 411 godkända testfall. Det inställningsstyrda omstartsprovet kördes separat mot disponibel PostgreSQL 18 tillsammans med provet för ett utgånget arbetsanspråk. Båda passerade. Platsprovet kördes dessutom med ordinarie API- och arbetarroller i separat lokal PostgreSQL 18 och städade testdata.

## Fortsatt verifiering utan partner

Webbens 122 automatiska tester och 11 Chromium-scenarier passerade. Den separata lokala kedjan från portal via HTTPS och API till PostgreSQL verifierade konto, order, produktåtkomst, laddsessionslista, sessionsdetalj och paginerade fordon, inklusive avgränsning för förare och ekonomi.

Laddrevision `252b40b` rättar en samtidighetskonflikt som reproducerades i PostgreSQL 18 när två avräkningsarbetare kvitterade samma Stripe-rad. Efter rättningen återläser båda arbetarna samma kvittens. Om Stripe returnerar samma fakturarad för en annan bokföringsnyckel avbryts avräkningen och slutkvittensen sparas inte. Körningen med PostgreSQL samt betalnings-, avräknings- och mobilproven gav 89 godkända testfall. Rättningen är lokalt verifierad.

Stripe-kontot Flexexa Ladda – Staging bekräftades vara i testläge. Skrivskyddad avläsning visade tidigare slutförda Checkout-sessioner och betalda testfakturor. Utfall vid en ny automatisk förnyelse i staging återstår.

Laddrevision `d3d7689` passerade företagsprovet med tre produktkombinationer i ett separat PostgreSQL 18-kluster, inklusive referensklient, avgränsat mandat och återkallelse. Samma prov kan köras med `TEST_LIMITED_ROLLOUT_DATABASE_URL` riktad mot en tom lokal `charging_test`-databas. Ytterligare 13 prov passerade i separata kluster för kontokatalog, företagskostnader, historisk fordonsfördelning, migrationsparitet och fristående Gridex-flöde med simulerad betalning.

Samma lokala PostgreSQL 18-körning kompletterades med 14 prov för integritetsgranskning, fysiskt laddbevis från syntetiska källor, stängning av operatörsmånad och lokal återställning av en förseglad period. Sammanlagt passerade 28 testfall i disponibla kluster den 23 november. Ingen hanterad backupövning ingick.

### Avräkningsarbetarens releasekontroll

Laddarbetaren i `charging-subscription-sandbox` kör paketet från `c03c2a7`, verifierat med Lambda-arkivets hash. Arbetarens skrivskyddade runtime- och leverantörsprov passerade med sandboxens databasroll, verifierad TLS och Stripe i testläge. Avräkningens särskilda testläge är avstängt i den funktionen. Sandboxen hade noll fakturabindningar, radkvittensposter och radavsikter vid avläsning.

Den integrerade kandidaten innehåller den nya kvittensvägen från 057. Den hostade äldre vägen har redan konfliktsäker radkvittens i sitt separata register och har även skydd för betalningsåterställning och delade fakturor. Ett byte av hela Lambda-paketet skulle byta ut dessa betalningsvägar. De måste förenas och testas innan stagedrift. Den byggda kandidaten publicerades därför inte till den befintliga arbetaren.

Källjämförelsen hittade även ett tappat skydd i laddstoppets API och arbetare. `6649026` återför leverantörsspecifik återläsning, säkra sluttillstånd, idempotent återspelning av stopp och stagingens hantering av förnyelsejobb. Portat databasprov täcker bekräftelse, fel leverantörssession, avslag, timeout och upprepade stopp. Den lokala backendkörningen gav 412 godkända testfall och ett inställningsstyrt hopp för det tidigare separat godkända PostgreSQL-omstartsprovet.
