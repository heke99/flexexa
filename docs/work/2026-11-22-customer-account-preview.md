# Kontovy i Next · 22 november 2026

FX-001–004 har en autentiserad konto- och produktvy i rotprojektet. Kontovyn visar de privat- och företagsmedlemskap som ladd-API:t returnerar för den aktuella Supabase-sessionen. Kunden kan uppdatera listan och logga ut. Köp, kontoskapande och kontoåterställning hanteras i den befintliga kundportalen. [Novemberplanen](../FLEXEXA_MASTERPLAN_2026-11-01.md)

Förhandsvisningen är avstängd som standard. Då leder `/app/konto` och `/app/konto/oversikt` till den fasta kundportalen. För lokal körning behöver `FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW` vara `true`. `FLEXEXA_CUSTOMER_AUTH_URL` och `FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY` anger kundernas Auth-projekt och dess publika nyckel. `FLEXEXA_CUSTOMER_API_URL` anger ladd-API:ts HTTPS-ursprung för samma miljö. Next vidarebefordrar enbart den presenterade åtkomsttokenen till API:ts kontolista. Kontosvaren använder `no-store`. Förhandsvisningen håller sessionen i minnet och kräver ny inloggning efter omladdning.

Webbläsarprovet kör `node scripts/web/verify-customer-account.mjs` efter produktionsbygget. Det använder Chromium och OpenSSL med lokal HTTPS och syntetiska identiteter. Det provar separata kontolistor, MFA-hänvisning, omladdning, utloggning och tom webbläsarlagring. Databasprovet kör `node scripts/web/verify-customer-account-native.mjs /sökväg/till/charging-subscription` med båda projektens installerade beroenden. Det kör Next mot ladd-API:t och en ny lokal PostgreSQL-databas och provar två kunders kontogräns, ekonomirollen, felaktiga token, admincookies och blockerad omdirigering från API:t.

Arbetet använde projektets Next.js-, Supabase- och verifieringsprofiler. Leveransen behöver provas med den avsedda nätvägen och riktig kund-Auth i staging innan den kan aktiveras där. Den fullständiga gemensamma PWA:n återstår. [Kravstatus](../progress/masterplan-remaining-2026-11-22.md)

## Produktåtkomst per konto

Kontovyn visar Laddabonnemang och Energioptimering med åtkomststatus för valt konto. Statusen följer ladd-API:ts beslut och skiljer en aktiv produkt från en begäran, indragen åtkomst eller ett beslut vars övriga villkor ännu saknas. Kontobyte och förnyad medlemskontroll rensar tidigare produktsvar. Knappen i vyn leder till befintlig produktportal för ändringar. Med samma förhandsvisning aktiverad leder `/app/produkter` till kontovyn. [Produktrutt](../../src/app/api/kundkonto/[accountId]/produkter/route.ts)

Produktprovet i Chromium kontrollerade fem statusar, två identiteter, ett fördröjt svar vid kontobyte samt försök igen efter ett tillfälligt API-fel. PostgreSQL-provet läste behörigheter och väntande begäran som ekonomimedlem, nekade annan kunds konto och kontrollerade att ogiltigt konto-ID eller saknad token stoppades utan anrop till ladd-API:t. [Webbläsarprov](../../scripts/web/verify-customer-account.mjs) · [Databasprov](../../scripts/web/verify-customer-account-native.mjs)

## Tvåstegsverifiering med kodapp

När ladd-API:t kräver tvåstegsverifiering kan en redan registrerad och verifierad TOTP-kodapp bekräfta inloggningen i PWA:n. Konton läses på nytt först när Supabase gett AAL2 för samma användare. Avbrott rensar vyn omedelbart. En lyckad verifiering som anländer efter avbrott utlöser lokal utloggning för den sena sessionen. Övriga faktortyper och återställning går via kundportalen. Chromium med en lokal Supabase-fixture provade fel kod, sen lyckad verifiering efter avbrott, lyckad inloggning och avgränsad produktläsning. Den avsedda kundmiljön återstår att prova med riktig Supabase Auth. [Webbläsarprov](../../scripts/web/verify-customer-account.mjs)

## Åtkomstbegäran och e-postkod

Kontoägaren kan begära åtkomst för de två erbjudandena i produktvyn. Ladd-API:t kontrollerar aktuell ägarroll, kontotillhörighet och företagskravet för energioptimering. En ny läsning visar den sparade begäran. Chromium verifierade knappen och statusen Begärd. Det lokala PostgreSQL-provet nekade främmande konton och ekonomianvändaren, stoppade fel ursprung innan ladd-API:t och bekräftade att omförsök sparar en begäran utan att ändra produktlicensen.

E-postkod för befintliga kunder aktiveras separat genom `FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW=true` tillsammans med kontoförhandsvisningen. Chromium verifierade samma sessionsgränser som för lösenord samt fel kod, omsändningsspärr och avbruten verifiering. Den driftade Supabase-mallen behöver bekräftas med numerisk engångskod innan funktionen kan aktiveras i staging. Lokala prov använde syntetiska inloggningssvar. [Verifierare](../../scripts/web/verify-customer-account.mjs)

## Beställningar, fordon och offline

Kontoägare och ekonomimedlemmar kan läsa de senaste beställningarnas referens och status. Belopp visas när ordern har ett verifierat prisunderlag i SEK. Ägare kan öppna den befintliga kundportalens beställningssida. Fordonsvyn visar 25 åt gången, med kontoavgränsad sidmarkör och ladd-API:ts fordonsbehörigheter. Next och PostgreSQL bekräftade att föraren ser sitt tilldelade fordon och att annan kunds konto, sidmarkör och beställningar nekas. Chromium bekräftade också att ett fördröjt ordersvar för det föregående kontot aldrig visas för det nya kontot. [Webbläsarprov](../../scripts/web/verify-customer-account.mjs) · [Databasprov](../../scripts/web/verify-customer-account-native.mjs)

Service workern ger en svensk reservvy för fem publika sidor efter ett nätfel. Den skapar ingen Cache Storage och hanterar bara publika navigeringar utan frågesträng. Chromium stängde den lokala servern och bekräftade att inloggade läsningar och skrivningar misslyckades under avbrottet, att inget anrop spelades upp efter återanslutning och att en ny identitet kunde logga in. Installation och uppgradering på stödda fysiska enheter återstår. [Service worker](../../public/service-worker.js)

## Kund-API:ts svar och felsökning

Båda förhandsvisningsflaggorna accepterar exakt `true` eller `false`. En utelämnad flagga betyder avstängt. E-postkod kräver en aktiv kontoförhandsvisning. En aktiv kontoförhandsvisning kräver två HTTPS-ursprung och Auth-projektets publika nyckel. Ogiltiga värden stoppar produktionsbygget. En ogiltig konfiguration som tillförts i drift ger HTTP 404 med `UNAVAILABLE`, teknikklassen `CONFIGURATION_INVALID` och loggade konfigurationsnamn.

Kundproxyn svarar med `Cache-Control: no-store` och ett nytt servergenererat `X-Request-ID`. Svarets JSON är fortsatt `{error}` vid fel. Lokal ogiltig indata och avvisad sidmarkör ger HTTP 400. Saknad eller avvisad autentisering ger 401. Nekad åtkomst och de specifika kraven på MFA, återställning och verifierad e-post ger 403. Trafikbegränsning ger 429 med `Retry-After` när Commerce anger sekunder inom ett dygn.

Övriga Commerce-fel ger HTTP 503 med `UNAVAILABLE`. Svarets `X-Flexexa-Error-Class` anger `COMMERCE_TIMEOUT` efter tio sekunder, `COMMERCE_TRANSPORT` vid nätfel eller omdirigering, `COMMERCE_REJECTED` för ett oväntat 4xx-svar, `COMMERCE_UNAVAILABLE` för 5xx och `COMMERCE_INVALID_RESPONSE` för ogiltigt svarsformat eller oväntad framgångsstatus vid skrivning. Strukturerade driftloggar innehåller samma korrelations-ID, en fast ruttkategori, teknikklassen och vid behov HTTP-status eller namnen på felkonfigurerade fält.

Ett ogiltigt produktbeslut eller en ogiltig orderrad gör hela läsningen tillfälligt otillgänglig. Äldre ordrar utan prisavtal kan fortfarande visa referens och status. Bara en betald eller återbetald order med ett verifierat SEK-belopp för en vara visar pris. Kund-ID:n använder vanliga UUID-varianter och avvisar nil- och maxvärden. Fordonssidor följer Commerce-markören. En sista sida med exakt 25 fordon har också `nextCursor: null`.

Kör `node scripts/web/verify-customer-api-contract.mjs` efter `pnpm build` för att prova felklassning, tidsgräns, konfigurationsgrind och loggfält mot en lokal HTTPS-fixture.

## Laddhistorik i skyddad förhandsvisning

Kontovyn kan visa de tio senaste laddsessionerna och detaljer för en vald session. Commerce avgör vilka konton och sessioner den presenterade åtkomsttokenen får läsa. Next vidarebefordrar enbart referens, status och tidsstämplar. En nekad läsning rensar laddhistoriken och hämtar om kontolistan. Sessionssvaren har `no-store` och korrelations-ID. Saknad eller oåtkomlig sessionsdetalj som Commerce klassar som 404 visas som `NOT_FOUND`.

En separat skyddad Vercel-preview behöver `FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW=true`, `FLEXEXA_CUSTOMER_AUTH_URL`, `FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY` och `FLEXEXA_CUSTOMER_API_URL` för samma sandboxmiljö vid både bygge och körning. Bygget lägger in enbart det avsedda Auth-ursprunget i webbläsarens `connect-src`. E-postkod styrs separat av `FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW`. Lösenordsprovet kräver varken e-postkod eller utskick.

Det lokala Chromiumprovet bygger en produktionsapp med Auth-fixturens tilldelade port. Kör `node scripts/web/verify-customer-account.mjs` i en separat checkout. Provet kör både mobil och dator, inklusive kontobyte, sen sessionsdetalj, tom historik, borttagen behörighet och utloggning. Native-provet kopplar samma Next-rutter till verklig loopback Commerce och PostgreSQL. För värdbevis behövs behörig Vercel-inloggning i mobilprofil med betrodd TLS-kedja samt en förberedd disponibel sandboxidentitet med isolerade konton och sessioner. [Chromiumprov](../../scripts/web/verify-customer-account.mjs) · [Databasprov](../../scripts/web/verify-customer-account-native.mjs)
