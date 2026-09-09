# API-client identity administration verification

## Scope
PR #14 builds on merged #13 (`fb8d081b3a042d836837ddbcc10d3191173c769e`).
Two narrow MFA-authenticated tenant administration RPCs enroll an already provisioned,
pre-attested dedicated Auth subject and terminally revoke its canonical binding.
No credentials, client catalog, grants store or competing outbox is introduced.

## Executed evidence
- Candidate head `f6a8a110c4cc0cbae6975680a808d132552931ae`, reviewed tree `7cd37a9eaaf24e1675e48a08b81b8fa0903f222c`.
- Candidate run `34392561152`, job `102604228255`: all proposal steps SUCCESS, including clean migration replay, PostgreSQL assertions and real concurrent identity administration.
- Application and existing database run `34392561071`: both jobs SUCCESS on the same candidate.
- Artifact `10120302882` ZIP SHA256 `cd739a3d1ef5ec3c1c3de4310e3154dfb0397d4ee297d59f12e94b81a4550e4c` verified. All twelve extracted migration inputs match the reviewed source; eleven historical files unchanged.
- Candidate SQL: 10,990 bytes, SHA256 `924c8ecc1427cfbe9365d4a0b51b449b5a4658a66cee5983d5b7371b17ce47fe`.
- Same SQL applied to Stockholm `flexexa-dev`; authoritative recorded version `20260909190638` and byte/hash read-back matched. Twelve migrations recorded. No live principal fixtures created.
- Live catalog confirms public invoker wrappers, guarded private definer, empty function search paths, anonymous execution denied and normalizer/session helpers not exposed to authenticated callers.
- Supplemental local suite: 354 source tests; package typecheck. These Node22/TS5.8 checks are not final pinned evidence.

## Permanent gates
The temporary candidate workflow is removed; migration/test files now live in their
permanent paths. Ordinary database verification must run all twelve migrations, existing
307 and 48 new pgTAP assertions, existing 144 contract cases and 92 race calls, 40 new
concurrent identity calls, existing typed mutation bridge and machine preflight checks.
The identity test proves the same machine session loses permission after committed revocation.
Final tracked-only CI and review are required on the final source head before merge.

## Limits and follow-on
No Auth user creation, secret delivery, service-principal enrollment, public HTTP endpoint,
OAuth/consent, provider activation, physical commands, funds or AWS changes. Enrollment
requires a trusted provisioning attestation that user metadata cannot supply. It grants
no API permission. Receipts are history, not authentication tickets. Phase 0 stays open.
