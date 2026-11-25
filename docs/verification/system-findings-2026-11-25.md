# Flexexa · Samlad fyndlista (2026-11-25)

Uppdaterad 25 november 2026 efter genomsökning av `heke99/flexexa` (`main` @ `c35a75d`), `heke99/charging-subscription` (`main` @ `c26766f`), Supabase `flexexa-dev` (`zhgwlvmtvwjftyjmgljw`, migrering 062 + `harden_security_definer_rpc_grants`), byggspecifikationen (`Flexexa_Energy_Wizard_byggspec.md`) och statusrapporten från 24 november.

## Åtgärdade fynd (2026-11-25)

- **Supabase Security Advisor lint `0028` och `0029`:** Åtgärdade och verifierade i `flexexa-dev` via `supabase/migrations/20261125095000_harden_security_definer_rpc_grants.sql` (sammanslagen i PR #78). `EXECUTE` på `public.flexexa_applications(text, text, jsonb)` och `public.flexexa_platform_charging_inventory(uuid)` är nu begränsad till `service_role`.
- **Supabase Health Advisor:** 0 hälsofynd i `flexexa-dev`.
- **OpenAPI (`public/openapi/partner-offers-v1.json`):** Verifierad som giltig OpenAPI 3.1.0 / JSON (v1.1.0).

## Kvarvarande fynd (F-01 till F-11)

| ID | Nivå | Område | Brist | Källa / Bevis |
| --- | --- | --- | --- | --- |
| **F-01** | Kritisk | Kod & R51 | `scripts/quality/capacity-endurance.mjs` har `minimumFreeMiB = 512` och avbryter dygnsprovet med `SCRATCH_SPACE_LOW` (stoppades vid 511 MiB efter 20h 38m). Under körningen tappades 76 schemalagda läsanrop och 73 telemetriobservationer. | `scripts/quality/capacity-endurance.mjs`, statusrapport 24 nov |
| **F-02** | Kritisk | Säkerhet / ECS | Nio kvarstående höga containerfynd i senaste ECS-rapporten måste bedömas och åtgärdas inför breddlansering. | Byggspecifikation (13 nov) |
| **F-03** | Kritisk | Etapp 1 / Mobil | Laddhistoriken (`c9271dd` på `codex/flexexa-session-preview-abc5ed3`) saknar inloggat mobilwebbläsarprov före publicering. | Statusrapport 24 nov |
| **F-04** | Kritisk | Etapp 3 / Stripe | Verklig automatisk Stripe-förnyelse via Stripe CLI-testklocka i staging är inte körd (parkopplingen löpte ut). | Statusrapport 24 nov |
| **F-05** | Hög | Supabase Auth | *Leaked Password Protection* (HaveIBeenPwned) är avstängt i `flexexa-dev`. | Supabase Security Advisor (`WARN`) |
| **F-06** | Hög | Supabase RLS | 11 dubbla tillåtande (`PERMISSIVE`) RLS-policys på `accounts`, `driver_grants`, `driver_invitations`, `settlement_invoice_bindings` och `audit_events`. | Supabase Performance Advisor (`lint 0006`, `WARN`) |
| **F-07** | Hög | Klient & Audit | Signerade Expo-appbyggen är oprövade på fysiska enheter och äldre klientversioner; operativ integritetsacceptans och kvarvarande auditfynd mot Engineering Startkit v3.1.0 är öppna. | Statusrapport 24 nov |
| **F-08** | Medel | Supabase Index | 89 oindexerade främmande nycklar, bl.a. på `sessions`, `orders`, `outbox`, `energy_vehicle_commands`, `fleet_plan_jobs` och `audit`. | Supabase Performance Advisor (`lint 0001`, `INFO`) |
| **F-09** | Medel | Supabase Auth | Fast gräns på max 10 DB-anslutningar för Auth i stället för procentuell allokering. | Supabase Performance Advisor (`INFO`) |
| **F-10** | Medel | Hygien | 9 gamla öppna draft-PR:er (#1, #57–#64), 86 oanvända index i `flexexa-dev`, parallella TypeScript-versioner i `package.json` (`6.0.2` och `7.0.2`) samt obekräftad radering av extern engångsbrevlåda. | GitHub, `package.json`, Supabase Performance Advisor (`lint 0005`), statusrapport 24 nov |
| **F-11** | På vänt | Externa parter | Fysisk laddbox och BMW 330e-pilot, Enode-avtal, verklig partner-OAuth (sandbox saknar partnerklienter), skarpt roamingunderlag, BSP-avtal/redovisningsmodell för Grid Rewards samt hanterad Supabase-återställning. | Byggspecifikation & statusrapport 24 nov |
