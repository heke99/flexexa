# Versioned country packs

Locked master §§81/83: national data belongs here. `se/v1.json` contains the
Swedish metadata already used by the core schema: price areas, currency, timezone
and locale. Only `metadata` is ready. Tax, price/tariff sources, TSO, actor IDs,
flex products and meter rules remain unimplemented and fail closed through
`requireCountryDomain`. Pack presence never grants market or physical control authority.

New callers use `@flexexa/api-contracts/country-packs`: choose a country explicitly;
an unknown pack requires an explicit valid timezone. This is location inventory,
not automatic market eligibility. Country packs are a source directory in the
locked monorepo, with no additional third-party dependency.

## Existing wire compatibility

The existing V1 site contract defaults to SE / Europe/Stockholm. Even an explicit
foreign country without timezone keeps the historical V1 timezone: changing it
would alter normalization and saved idempotency hashes. Clients creating foreign
sites must supply timezone. A stricter future wire version must define its own
normalization and migration/receipt compatibility; never silently repoint V1.

`se/v1.json` is immutable once applied. Add a new version for changed metadata.
`scripts/country-packs/render-defaults.mjs` compiles the four V1 defaults and the
existing normalizer into one forward migration. The source hash, exact generated
SQL test and applied-history hashes prevent unnoticed edits. Archived migrations
retain their original literals and identities. Existing rows are not rewritten.

CI replays every migration, compares SQL defaults and market areas to TypeScript,
tests actual inserts and V1 payloads, then runs all prior RLS, contracts,
idempotency/concurrency and real Auth/container checks.
