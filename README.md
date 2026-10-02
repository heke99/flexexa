# Flexexa

Flexexa bygger smart laddning och en spårbar flexibilitetsplattform med egna
kanoniska modeller, utbytbara anslutnings- och BSP-adaptrar samt white label.

## Hela masterplanen

| Dokument | Användning |
| --- | --- |
| [Komplett masterplan på svenska](docs/plans/FLEXEXA_MASTERPLAN_SV.md) | Läs hela målbilden, avsnitt 0–87, faser 0–13, datafält och acceptanskrav. |
| [Låst masterplan V1](FLEXEXA_MASTER_BUILD_PROMPT_V1.md) | Styrande originalkrav och arkitektur; inga avsnitt eller faser får hoppas över. |
| [Leveranskrav V1.1](docs/plans/FLEXEXA_DELIVERY_ACCEPTANCE_V1_1.md) | Tio FXP-krav och 31 specificerade acceptansfall; kompletterar originalet. |
| [Genomförande och nästa paket](docs/plans/GENOMFORANDE.md) | Fortsätt från faktiska källversioner, beroenden och återstående grundkrav. |
| [Agentkontrakt](AGENTS.md) | Färdigheter, kodpåverkan, säkerhet och verifiering före varje ändring. |
| [Kravspårning](docs/progress/masterplan-traceability.md) | Hur originalets 3 701 källpunkter följs utan att källinventering blir produktgodkännande. |

Fas 0 är pågående. Målstrukturen i planen beskriver även tjänster och funktioner
som ännu inte finns. CI-resultat och isolerade simulatorer ersätter inte driftsatt
verifiering, uppmätt fysisk laddning eller erforderlig extern acceptans.

## Fortsätta bygga

Läs genomförandet och relevanta originalavsnitt först. Använd Node 24 och repots
låsta pnpm 12.3.4 genom Corepack. Följ index → påverkan → relevanta tester → fryst
slutkandidat → full verifiering → granskning → ordinarie merge.

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm plan:check
corepack pnpm index:codebase
corepack pnpm impact -- --base <målgren-eller-källversion>
corepack pnpm verify:affected -- --base <målgren-eller-källversion>
```

Kör de särskilda kontroller som påverkan kräver. `--application-only` kan användas
för en avgränsad lokal applikationskörning, men lämnar uttryckligen övriga grindar
öppna. `corepack pnpm plan:ready` ska fortsatt misslyckas när fas- eller kravbevis
saknas; kommandot kontrollerar registrerad integritet och autentiserar inte externa
resultat. Verifierad källversion, miljö och faktiskt granskat bevis måste stämma.
