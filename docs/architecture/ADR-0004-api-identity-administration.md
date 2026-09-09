# ADR-0004 — Audited dedicated API-client identity enrollment

Status: candidate; not applied or accepted until exact final CI and development read-back.

## Scope and separation
A tenant administrator may enroll an existing dedicated Auth subject into an existing
canonical confidential/API-key client, or terminally revoke that binding. Both operations
require `api_clients.manage`, a current MFA session, active tenant/organization/membership,
and the existing transactional receipt/audit/outbox boundary. There is no alternate client,
credential or grants store. Existing public clients and platform/service identities are not
enrolled through this tenant endpoint. No permission or secret is issued by enrollment.

The trusted Auth provisioning service must create a separate subject and set the exact
`raw_app_meta_data.flexexa_machine_enrollment` object:
`{version:1, tenant_id:<canonical UUID>, api_client_id:<canonical UUID>, environment:<sandbox|production>}`.
It must never copy that marker from user_metadata or a browser body. Those Auth-management
calls and credential custody are a separate privileged integration, not implemented here.
The SQL boundary verifies the trusted marker and refuses human/platform memberships,
existing sessions, anonymous/deleted/banned subjects, self-enrollment and previous bindings.
The existing client must be active, non-public and have a finite future expiry. The immutable
binding uses that expiry. API keys are not collected, returned or logged in this workflow.

## Transaction guarantees
The Auth user is locked before the canonical client and binding. Auth session insertion
references the same user; concurrent enrollment attempts cannot each create bindings.
Identical retries preserve the original receipt, while changed payloads fail. Authorization
is checked before every receipt replay. Revocation is terminal, keeps the enrollment history
and requires a new dedicated subject for replacement. It does not modify another principal,
upstream provider tokens or a physical charging plan. A receipt is historical, not an access token.
Machine resource authorization still uses the session-bound checker and must be rechecked
inside each future resource mutation. No cached preflight approvals are introduced.

## Verification and continuation
Candidate CI runs the complete existing suite plus negative PostgreSQL assertions and
40 real concurrent calls through the TypeScript descriptors/receipt decoders. The same
machine-session fixture must lose preflight permission after a committed revocation.
Old migrations stay immutable. No new dependency, production fixture or provider I/O.

Activated skills: Supabase, Postgres best practices, codebase index, impact/affected
verification, security/code review and test strategy. Browser, physical-device and AWS
runtime skills are intentionally deferred: this change adds no UI or runtime activation.

Sources checked 2026-09-09:
- https://supabase.com/docs/guides/auth/sessions
- https://supabase.com/docs/guides/auth/users
- https://www.postgresql.org/docs/17/explicit-locking.html
- Locked master plan sections 15–22, 68, 70–71, 77–79 and 83–87.
