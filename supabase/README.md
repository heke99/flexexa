# Flexexa Supabase

Remote development project: `flexexa-dev` in `eu-north-1` (Stockholm).

Database changes are migration-first. Do not make untracked schema changes in the dashboard.

Current Phase 0 migration history:
- 20260909104034 phase0_identity_tenancy_rbac
- 20260909104116 phase0_authorization_helpers_rls
- 20260909104210 phase0_harden_authorization_helpers

Security baseline:
- RLS enabled on every public table.
- Authz helper functions live in non-exposed `private` schema.
- Critical writes will be added as transactional RPCs rather than direct table writes.
- Cross-tenant negative tests are mandatory before merge.
