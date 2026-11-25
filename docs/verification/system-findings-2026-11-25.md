# Flexexa · Samlad fyndlista (2026-11-25)

Uppdaterad 25 november 2026 efter genomsökning av `heke99/flexexa` (`main` @ `c35a75d`), `heke99/charging-subscription` (`main` @ `c26766f`), Supabase `flexexa-dev` (`zhgwlvmtvwjftyjmgljw`, migrering 062 + `harden_security_definer_rpc_grants`), byggspecifikationen (`Flexexa_Energy_Wizard_byggspec.md`) och statusrapporten från 24 november.

## Åtgärdade fynd (2026-11-25)

- **Supabase Security Advisor lint `0028` och `0029`:** Åtgärdade och verifierade i `flexexa-dev` via `supabase/migrations/20261125095000_harden_security_definer_rpc_grants.sql` (sammanslagen i PR #78). `EXECUTE` på `public.flexexa_applications(text, text, jsonb)` och `public.flexexa_platform_charging_inventory(uuid)` är nu begränsad till `service_role`.
- **Supabase Health Advisor:** 0 hälsofynd i `flexexa-dev`.
- **OpenAPI (`public/openapi/partner-offers-v1.json`):** Verifierad som giltig OpenAPI 3.1.0 / JSON (v1.1.0).

## Kvarvarande fynd (F-01 till F-23)

| ID | Nivå | Område | Brist | Källa / Bevis |
| --- | --- | --- | --- | --- |
| **F-01** | Kritisk | R51 / `capacity-endurance.mjs` | `minimumFreeMiB = 512` avbryter dygnsprovet vid `SCRATCH_SPACE_LOW` (511 MiB), 76 tappade läsanrop / 73 telemetriobservationer. | `scripts/quality/capacity-endurance.mjs`, statusrapport 24 nov |
| **F-02** | Kritisk | ECS / Säkerhet | Nio kvarstående höga containerfynd i senaste ECS-rapporten. | Byggspecifikation (13 nov) |
| **F-03** | Kritisk | Etapp 1 / Mobil | Laddhistoriken (`c9271dd`) saknar inloggat mobilwebbläsarprov före publicering. | Statusrapport 24 nov |
| **F-04** | Kritisk | Etapp 3 / Stripe | Verklig automatisk Stripe-förnyelse via Stripe CLI-testklocka är inte körd. | Statusrapport 24 nov |
| **F-05** | Hög | Supabase Auth | *Leaked Password Protection* är avstängt i `flexexa-dev`. | Supabase Security Advisor (`WARN`) |
| **F-06** | Hög | Supabase RLS | 11 dubbla tillåtande (`PERMISSIVE`) RLS-policys. | Supabase Performance Advisor (`lint 0006`, `WARN`) |
| **F-07** | Hög | Klient & Audit | Signerade Expo-appbyggen oprövade; kvarvarande auditfynd mot Engineering Startkit v3.1.0 öppna. | Statusrapport 24 nov |
| **F-08** | Medel | Supabase Index | 89 oindexerade främmande nycklar. | Supabase Performance Advisor (`lint 0001`, `INFO`) |
| **F-09** | Medel | Supabase Auth | Fast gräns på 10 DB-anslutningar för Auth. | Supabase Performance Advisor (`INFO`) |
| **F-10** | Medel | Hygien | 9 gamla draft-PR:er, 86 oanvända index, parallella TypeScript-versioner, obekräftad radering av engångsbrevlåda. | GitHub, `package.json`, Supabase Performance Advisor (`lint 0005`), statusrapport 24 nov |
| **F-11** | På vänt | Externa parter | Fysisk laddbox/BMW, Enode, partner-OAuth, roaming, BSP/Grid Rewards, hanterad återställning. | Byggspecifikation & statusrapport 24 nov |
| **F-12** | Kritisk | `src/domains/applications/server.ts` | `rpc()` anropar `/rest/v1/rpc/flexexa_applications` med `anon`/`authenticated`-token, vilket bryter admininloggning och e-postcron efter migreringen `harden_security_definer_rpc_grants`. | `src/domains/applications/server.ts`, `src/app/api/admin/session/route.ts` |
| **F-13** | Hög | `next.config.ts` (CSP) | Saknar `default-src`, `script-src`, `object-src 'none'` och `base-uri 'self'` i CSP. | `next.config.ts` |
| **F-14** | Medel | `next.config.ts` (HSTS) | `Strict-Transport-Security` saknas i svarshuvudena. | `next.config.ts` |
| **F-15** | Medel | `/api/internal/application-emails/route.ts` | `catch {}` sväljer felet utan loggning, returnerar generisk `503`. | `src/app/api/internal/application-emails/route.ts` |
| **F-16** | Hög | `/api/admin/session/route.ts` | Superadmin-e-post (`hekmat.h@div3rsa.com`) hårdkodad i publikt repo i stället för miljövariabel. | `src/app/api/admin/session/route.ts` |
| **F-17** | Medel | `/api/admin/session/route.ts` | Inloggningslänken hårdkodar `https://www.flexexa.com/admin` (pekar alltid mot produktion). | `src/app/api/admin/session/route.ts` |
| **F-18** | Medel | `/api/admin/session/route.ts` | `RESEND_API_KEY` skickas utan föregående kontroll, `catch {}` sväljer felorsaken med generisk `401`. | `src/app/api/admin/session/route.ts` |
| **F-19** | Låg | `public/service-worker.js` | `publicPages` saknar `/energy-wizard` och `/energy-wizard/planering` (ingen offline-vy för Energy Wizard). | `public/service-worker.js` |
| **F-20** | Hög | `src/lib/customer-account-api.ts` | `catch {}` sväljer alla fel utan loggning, returnerar generisk `503`. | `src/lib/customer-account-api.ts` |
| **F-21** | Medel | `src/lib/customer-account-api.ts` | `500`/`502` från API:t returnerar `503` i stället för `UPSTREAM_ERROR`. | `src/lib/customer-account-api.ts` |
| **F-22** | Medel | `src/lib/customer-account-config.ts` | `FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW` måste vara exakt `"true"` (strängjämförelse) — `"1"` eller `"yes"` inaktiverar hela kundkontoflödet tyst. | `src/lib/customer-account-config.ts` |
| **F-23** | Kritisk | `src/app/api/v1/energy-wizard/assess|plan|prices/route.ts` | Alla tre publika Energy Wizard-rutter returnerar hårt `403 PRODUCT_ACCESS_REQUIRED` och blockerar därmed hela den publika guiden, vilket bryter mot byggspecifikationens krav. | `src/app/api/v1/energy-wizard/assess|plan|prices/route.ts` |
