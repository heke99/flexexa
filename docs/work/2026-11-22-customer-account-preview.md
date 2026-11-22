# Kontovy i Next · 22 november 2026

FX-001–004 har en första autentiserad läsväg i rotprojektet. Kontovyn visar de privat- och företagsmedlemskap som ladd-API:t returnerar för den aktuella Supabase-sessionen. Kunden kan uppdatera listan och logga ut. Köpflöden, kontoskapande, engångskoder, tvåstegsverifiering och kontoåterställning hanteras i den befintliga kundportalen. [Novemberplanen](../FLEXEXA_MASTERPLAN_2026-11-01.md)

Förhandsvisningen är avstängd som standard. Då leder `/app/konto` och `/app/konto/oversikt` till den fasta kundportalen. För lokal körning behöver `FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW` vara `true`. `FLEXEXA_CUSTOMER_AUTH_URL` och `FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY` anger kundernas Auth-projekt och dess publika nyckel. `FLEXEXA_CUSTOMER_API_URL` anger ladd-API:ts HTTPS-ursprung för samma miljö. Next vidarebefordrar enbart den presenterade åtkomsttokenen till API:ts kontolista. Kontosvaren använder `no-store`. Förhandsvisningen håller sessionen i minnet och kräver ny inloggning efter omladdning.

Webbläsarprovet kör `node scripts/web/verify-customer-account.mjs` efter produktionsbygget. Det använder Chromium och OpenSSL med lokal HTTPS och syntetiska identiteter. Det provar separata kontolistor, MFA-hänvisning, omladdning, utloggning och tom webbläsarlagring. Databasprovet kör `node scripts/web/verify-customer-account-native.mjs /sökväg/till/charging-subscription` med båda projektens installerade beroenden. Det kör Next mot ladd-API:t och en ny lokal PostgreSQL-databas och provar två kunders kontogräns, ekonomirollen, felaktiga token, admincookies och blockerad omdirigering från API:t.

Arbetet använde projektets Next.js-, Supabase- och verifieringsprofiler. Leveransen behöver provas med den avsedda nätvägen och riktig kund-Auth i staging innan den kan aktiveras där. Den fullständiga gemensamma PWA:n återstår. [Kravstatus](../progress/masterplan-remaining-2026-11-22.md)

## Produktåtkomst per konto

Kontovyn visar Laddabonnemang och Energioptimering med åtkomststatus för valt konto. Statusen följer ladd-API:ts beslut och skiljer en aktiv produkt från en begäran, indragen åtkomst eller ett beslut vars övriga villkor ännu saknas. Kontobyte och förnyad medlemskontroll rensar tidigare produktsvar. Knappen i vyn leder till befintlig produktportal för ändringar. Med samma förhandsvisning aktiverad leder `/app/produkter` till kontovyn. [Produktrutt](../../src/app/api/kundkonto/[accountId]/produkter/route.ts)

Produktprovet i Chromium kontrollerade fem statusar, två identiteter, ett fördröjt svar vid kontobyte samt försök igen efter ett tillfälligt API-fel. PostgreSQL-provet läste behörigheter och väntande begäran som ekonomimedlem, nekade annan kunds konto och kontrollerade att ogiltigt konto-ID eller saknad token stoppades utan anrop till ladd-API:t. [Webbläsarprov](../../scripts/web/verify-customer-account.mjs) · [Databasprov](../../scripts/web/verify-customer-account-native.mjs)
