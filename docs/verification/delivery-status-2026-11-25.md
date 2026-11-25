# Flexexa · Leverans-, databas- och verifieringsstatus (2026-11-25)

Uppdaterad 25 november 2026 utifrån masterplanen, byggspecifikationen (`Flexexa_Energy_Wizard_byggspec.md`), statusrapporten från 24 november samt live-kontroll mot GitHub och Supabase (`flexexa-dev`).

## 1. Utfört och verifierat

- **GitHub-inventering:**
  - `heke99/flexexa` `main` @ `536ac9c` (PR #77, 22 nov).
  - `heke99/flexexa` `codex/flexexa-session-preview-abc5ed3` @ `c9271dd` (laddhistorik i förhandsmiljö).
  - `heke99/charging-subscription` `main` @ `c26766f` (PR #24).
  - `public/openapi/partner-offers-v1.json` verifierad som giltig OpenAPI 3.1.0 / JSON (v1.1.0).
- **Supabase-inventering (`flexexa-dev`, `zhgwlvmtvwjftyjmgljw`):**
  - Status `ACTIVE_HEALTHY` (Postgres 17, `eu-north-1`).
  - Migreringar verifierade t.o.m. **062** (`flexexa_charging_production_061_062_audited_payment`).
  - **Säkerhetsfynd åtgärdat via migrering:** `supabase/migrations/20261125095000_harden_security_definer_rpc_grants.sql` begränsar `EXECUTE` på `public.flexexa_applications(text, text, jsonb)` och `public.flexexa_platform_charging_inventory(uuid)` till `service_role` (åtgärdar Supabase Advisor lint `0028` och `0029`).
  - 23 tabeller har RLS aktiverat utan policys (`INFO`), vilket ger default-deny för `anon`/`authenticated` (förväntat för interna service-role-tabeller såsom `private.*`, `outbox_events` och `inbox_events`).

## 2. Teknisk åtgärdsplan för R51 (kräver att R51-branchen pushas)

Sökning efter `SCRATCH_SPACE_LOW` på `main` i `heke99/flexexa` gav 0 träffar, vilket visar att dygnsprovsskriptet ligger lokalt eller på en opushad gren. För att dygnsprovet (12 000 fordon, 24 h) ska passera behöver skriptet/workern:

1. **Eliminera `SCRATCH_SPACE_LOW`:** Strömma eller rotera temporära artefakter/loggar och rensa färdiga batchfiler löpande så att ledigt diskutrymme aldrig faller mot 511 MiB.
2. **Eliminera tappade anrop (76 läsanrop / 73 telemetriobservationer):** Införa begränsad kö med exponentiell backoff och retry på schemalagda läsanrop och telemetriinmatning, samt koppla backpressure mot anslutningspoolen.

## 3. Återstående manuella steg (kan ej köras automatiskt härifrån)

| Område | Åtgärd som kräver din miljö eller extern part |
| --- | --- |
| **Supabase Auth** | Aktivera *Leaked Password Protection* (HaveIBeenPwned) i Supabase Dashboard → Authentication → Password Security. |
| **Databasmigrering** | Applicera `20261125095000_harden_security_definer_rpc_grants.sql` mot `flexexa-dev` och produktion, och verifiera att backend anropar RPC:erna med `service_role`. |
| **R51-dygnsprov** | Pusha R51-skriptet, lägg in lagrings-/retry-fixen och kör om 24-timmarsprovet (12 000 fordon). |
| **Etapp 1 · Mobil & PWA** | Kör inloggat mobilwebbläsarprov på förhandsmiljön (`c9271dd`), publicera laddhistoriken, och testa signerade Expo-appbyggen på fysiska enheter. |
| **Etapp 3 · Stripe** | Parkoppla om Stripe CLI mot *Flexexa Ladda – Staging* och kör en automatisk förnyelse med testklocka. |
| **Externa beroenden (på vänt)** | Fysisk laddbox och BMW 330e-pilot, Enode-avtal, verklig partner-OAuth, BSP-avtal/redovisningsmodell för Grid Rewards samt hanterad Supabase-återställning. |
