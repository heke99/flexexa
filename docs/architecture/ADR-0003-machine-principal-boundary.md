# ADR-0003 — Session-bound machine authorization

Status: bounded implementation merged in PR #13 as `fb8d081b3a042d836837ddbcc10d3191173c769e`; final tracked run `34389879469` passed. No production identities, credentials or provider sessions provisioned.

## Boundary
Canonical services and API clients already exist. A private binding associates a dedicated
verified Supabase Auth subject with one canonical service or tenant-owned API client and one
mandatory sandbox/production environment. It is not a second API-client catalog or secret store.
Composite client ownership is database-enforced, identifiers are immutable, and revoked bindings
cannot be reactivated or deleted through ordinary DML. Binding administration needs a later
privileged audited provisioning workflow. No browser may create, read or modify these bindings.
Service tenant grants receive their missing canonical generated ID; existing keys stay intact.

Authorization derives the subject from the verified request session, never from submitted
service IDs, roles or user_metadata. It checks both Auth user and live session, organization,
tenant, principal, canonical service/client, permission, temporal grant and explicit environment.
Only exact environment-only scope/condition JSON is currently supported; empty/wildcard/extra
conditions deny. MFA, step-up, public clients and platform permissions deny until explicit
workload-assurance policies are implemented. No generic elevated database key is accepted as
an identity. A subject mapped to a machine is excluded from human and platform role evaluation,
even when the mapping is suspended or revoked. Mixed human/machine assignments deny both paths.

## Contracts and verification
The TypeScript descriptor exposes only the exact tenant/permission/environment RPC parameters.
A boolean decoder rejects truthy coercion and extra response shapes. The SQL function is a
current-statement preflight, **not** a reusable authorization ticket. Future resource RPCs must
independently authorize, record audit/outbox evidence and enforce ownership in their transaction.
Existing human mutation/read endpoints are not implicitly opened to machines by this change.
Enode and first-party adapters will use the same boundary; neither adapter is a control authority.

A revoked/deleted session denies on the subsequent READ COMMITTED statement/request. This is not
a claim of cancelling in-flight commands or serializable revocation across long-lived snapshots.
Auth inactivity policy enforcement is not implemented here; not_after and session presence are
checked. Bearer signature/expiry validation remains the authentication gateway's responsibility.
No token issuing endpoint or actual workload login is implemented by these SQL fixtures.

Sources checked 2026-09-09:
- https://supabase.com/docs/guides/auth/sessions (session_id/auth.sessions and sign-out semantics)
- https://www.postgresql.org/docs/17/functions-datetime.html (statement time vs transaction time)
- Repository master plan sections 15, 16, 66, 71, 78 and 83.
