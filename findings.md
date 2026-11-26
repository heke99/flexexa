# Flexexa – Samlad fyndrapport (F-01 till F-44)

**Datum:** 2026-11-26  
**Repository:** `heke99/flexexa`  
**Gren:** `docs/findings-20261126`  

Detta dokument samlar samtliga identifierade brister och fynd från kod-, API-, databas-, infrastruktur- och masterplangranskningen (`F-01` till `F-44`).

## Sammanfattning efter allvarlighetsgrad

- **Kritisk:** 6 (`F-01`, `F-02`, `F-03`, `F-04`, `F-12`, `F-23`)
- **Hög:** 11 (`F-05`, `F-06`, `F-07`, `F-13`, `F-16`, `F-20`, `F-24`, `F-28`, `F-32`, `F-36`, `F-42`)
- **Medel:** 20 (`F-08`, `F-09`, `F-10`, `F-14`, `F-15`, `F-17`, `F-18`, `F-21`, `F-22`, `F-25`, `F-26`, `F-29`, `F-30`, `F-33`, `F-34`, `F-37`, `F-38`, `F-39`, `F-40`, `F-43`)
- **Låg:** 6 (`F-19`, `F-27`, `F-31`, `F-35`, `F-41`, `F-44`)
- **På vänt (externa parter / miljö):** 1 (`F-11`)

## Fullständig fyndlista (F-01 till F-44)

| ID | Nivå | Fil / Område | Brist |
| --- | --- | --- | --- |
| **F-01** | Kritisk | R51 / `capacity-endurance.mjs` | `minimumFreeMiB = 512` avbryter 12 000-fordons dygnsprov vid `SCRATCH_SPACE_LOW` (511 MiB kvar efter ~20h38m), 1 238/1 440 jobb klara, 76 tappade läsanrop och 73 tappade telemetriobservationer. |
| **F-02** | Kritisk | ECS / Säkerhet | Nio kvarstående höga containerfynd i senaste ECS-rapporten. |
| **F-03** | Kritisk | Etapp 1 / Mobil | Laddhistoriken (`c9271dd`) saknar inloggat mobilwebbläsarprov före publicering. |
| **F-04** | Kritisk | Etapp 3 / Stripe | Verklig automatisk Stripe-förnyelse via Stripe CLI-testklocka är inte körd. |
| **F-05** | Hög | Supabase Auth | *Leaked Password Protection* är avstängt i `flexexa-dev`. |
| **F-06** | Hög | Supabase RLS | 11 dubbla tillåtande (`PERMISSIVE`) RLS-policys. |
| **F-07** | Hög | Klient & Audit | Signerade Expo-appbyggen oprövade; kvarvarande auditfynd mot Engineering Startkit v3.1.0 öppna. |
| **F-08** | Medel | Supabase Index | 89 oindexerade främmande nycklar. |
| **F-09** | Medel | Supabase Auth | Fast gräns på 10 DB-anslutningar för Auth. |
| **F-10** | Medel | Hygien | 9 gamla draft-PR:er, 86 oanvända index, parallella TypeScript-versioner, obekräftad radering av engångsbrevlåda. |
| **F-11** | På vänt | Externa parter | Fysisk laddbox/BMW, Enode, partner-OAuth, roaming, BSP/Grid Rewards, hanterad Supabase-återställning. |
| **F-12** | Kritisk | `src/domains/applications/server.ts` | `rpc()` anropar `/rest/v1/rpc/flexexa_applications` med `anon`/`authenticated`-token, vilket riskerar att bryta admininloggning och e-postcron efter migreringen `20261125095000_harden_security_definer_rpc_grants.sql`. |
| **F-13** | Hög | `next.config.ts` (CSP) | Saknar `default-src`, `script-src`, `object-src 'none'` och `base-uri 'self'` i Content-Security-Policy. |
| **F-14** | Medel | `next.config.ts` (HSTS) | `Strict-Transport-Security` saknas i svarshuvudena. |
| **F-15** | Medel | `src/app/api/internal/application-emails/route.ts` | `catch {}` sväljer felet utan loggning och returnerar generisk `503`. |
| **F-16** | Hög | `src/app/api/admin/session/route.ts` | Superadmin-e-post hårdkodad i publikt repo. |
| **F-17** | Medel | `src/app/api/admin/session/route.ts` | Inloggningslänken hårdkodar `https://www.flexexa.com/admin` (pekar alltid mot produktion). |
| **F-18** | Medel | `src/app/api/admin/session/route.ts` | `RESEND_API_KEY` skickas utan föregående kontroll; `catch {}` sväljer felorsaken med generisk `401`. |
| **F-19** | Låg | `public/service-worker.js` | `publicPages` saknar `/energy-wizard` och `/energy-wizard/planering` (ingen offline-vy för Energy Wizard). |
| **F-20** | Hög | `src/lib/customer-account-api.ts` | `catch {}` sväljer alla fel utan loggning och returnerar generisk `503`. |
| **F-21** | Medel | `src/lib/customer-account-api.ts` | `500`/`502` från API:t returnerar `503` i stället för `UPSTREAM_ERROR`. |
| **F-22** | Medel | `src/lib/customer-account-config.ts` | `FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW` måste vara exakt `"true"` (strängjämförelse) — `"1"` eller `"yes"` inaktiverar hela kundkontoflödet tyst. |
| **F-23** | Kritisk | `src/app/api/v1/energy-wizard/assess\|plan\|prices/route.ts` | Alla tre publika Energy Wizard-rutter returnerar hårt `403 PRODUCT_ACCESS_REQUIRED` och blockerar hela den publika guiden, vilket bryter mot byggspecifikationens krav. |
| **F-24** | Hög | `src/domains/partner-offers/catalog.ts` | Hårdkodade priser (`166000`/`157000`) och `terms_version` (`privat-2026-11-13-v5`) direkt i källkoden i stället för konfigurerbar källa. |
| **F-25** | Medel | `src/domains/partner-offers/catalog.ts` | `landing_url` och `energy_wizard_url` bygger URL:er utan URL-kodning av `partner`-parametern. |
| **F-26** | Medel | `src/app/api/kundkonto/[accountId]/produkter/route.ts` | `normalizeProductAccess()` returnerar `null` (→ `503`) på ett enda felaktigt fält i `payload.items`/`payload.requests`. |
| **F-27** | Låg | `src/lib/customer-accounts.ts` | `customerUuid`-regexen accepterar nil UUID och max UUID. |
| **F-28** | Hög | `src/app/api/kundkonto/[accountId]/bestallningar/route.ts` | `normalizeCustomerOrders()` returnerar `null` (→ `503`) på ett enda felaktigt fält i `payload.items` (all-or-nothing). |
| **F-29** | Medel | `src/app/api/kundkonto/[accountId]/bestallningar/route.ts` | `agreement`-objektet valideras bara för `paid`/`refunded`, ignoreras helt för `pending`/`blocked`. |
| **F-30** | Medel | `src/lib/customer-vehicles.ts` | `customerVehicleListPath()` bygger URL:en med `&after=${after}` utan URL-kodning av `after`-parametern. |
| **F-31** | Låg | `src/lib/customer-vehicles.ts` | `normalizeCustomerVehicles()` accepterar `nextCursor` när `items.length === pageSize` även om det är sista sidan (ingen `hasMore`-flagga). |
| **F-32** | Hög | `src/app/api/applications/route.ts` | `networkHash()` bygger hash från förfalskbara `x-vercel-forwarded-for`/`x-forwarded-for`-headrar, vilket gör rate-limiten kringgåbar. |
| **F-33** | Medel | `src/app/api/applications/route.ts` | `catch` sväljer felet utan loggning och returnerar generisk `503`. |
| **F-34** | Medel | `src/domains/applications/validation.ts` | `clean()` avvisar kontrolltecken men accepterar Unicode utanför BMP (emoji/andra skriftsystem); verifiera faktiskt krav innan åtgärd. |
| **F-35** | Låg | `src/app/api/applications/route.ts` | `is_test: data.email === "delivered@resend.dev"` är hårdkodat i stället för miljövariabel/flagga. |
| **F-36** | Hög | `src/domains/applications/server.ts` | `networkHash()` inkluderar `new Date().toISOString().slice(0,10)` (dagens datum) i hashen — rate-limiten nollställs varje dag vid midnatt UTC. |
| **F-37** | Medel | `src/domains/applications/server.ts` | `sendPendingEmails()` — `catch {}` sväljer felet utan loggning, vilket gör fel som `EMAIL_NOT_CONFIGURED` och `INVALID_EMAIL_RECEIPT` osynliga. |
| **F-38** | Medel | `src/domains/applications/server.ts` | `rpc()` skiljer inte på `429` (rate-limit), `500`/`502`/`503` (serverfel) eller nätverksavbrott — allt mappas till `DATABASE_UNAVAILABLE`. |
| **F-39** | Medel | `src/app/api/admin/applications/route.ts` | `catch` sväljer felet utan loggning och returnerar generisk `403`, vilket döljer verkliga driftfel. |
| **F-40** | Medel | `src/app/api/admin/applications/route.ts` | `page`-parametern tillåter värden upp till `100000`, vilket kan orsaka onödigt stor offset i RPC:n och prestandaproblem/DoS. |
| **F-41** | Låg | `src/app/api/kundkonto/[accountId]/bestallningar/route.ts` | `agreement?.amount_minor` valideras bara för `paid`/`refunded`; för `pending`/`blocked` kan skadade `agreement`-fält passera utan validering (detaljering av `F-29`). |
| **F-42** | Hög | `src/app/api/applications/route.ts` | `GET /api/applications` saknar rate-limit helt — `rpc("stats")` anropas obegränsat och möjliggör DoS mot databasen. |
| **F-43** | Medel | `src/app/api/applications/route.ts` | `GET /api/applications` returnerar generisk `503` vid alla fel, inklusive `429` rate-limit från RPC:n, utan loggning. |
| **F-44** | Låg | `src/app/api/applications/route.ts` | `GET /api/applications` saknar `Vary: Origin`-header, vilket kan orsaka cache-förgiftning i proxy/CDN. |

## Poster som kräver användarmiljö eller externa parter

- **F-01:** Långvarigt 24h R51-dygnstest efter justering av scratch-space/tröskel.
- **F-02:** Åtgärd och omkörning av ECS-containerscanning.
- **F-03:** Inloggat mobilwebbläsarprov för laddhistorik (`c9271dd`).
- **F-04:** Stripe CLI-testklocka för verklig automatisk förnyelse.
- **F-05, F-09:** Ändringar i Supabase Dashboard (Auth Leaked Password Protection, DB-anslutningsgräns).
- **F-07:** Signerade Expo-appbyggen och kvarvarande Engineering Startkit-audit.
- **F-11:** Fysisk laddbox/BMW, Enode, partner-OAuth, roaming, BSP/Grid Rewards, hanterad Supabase-restore.
