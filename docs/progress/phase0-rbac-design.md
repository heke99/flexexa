# Tenant-owned and temporal authorization

This step replaces shared tenant-role rows with platform templates and actual role instances per tenant. Tenant role IDs can never be assigned across tenants. Global platform roles remain an explicit separate scope, protected by MFA and without implicit tenant-control rights.

The permission catalog contains all 55 V1 keys, plus metering_points.read/write and platform.manage. Legacy keys remain as deprecated aliases for existing policy/function consumers; aliases resolve to the same canonical permission before allow/deny evaluation. Deny cannot be bypassed by switching spelling.

Validity is [valid_from, valid_until). Historical repeated role/grant assignments use distinct IDs and PostgreSQL range exclusions to prevent overlaps. Expired membership, assignment, grant or override is not active. Suspended tenants, organizations and roles are denied. Conditional allows require a supported evaluator; unknown conditions and unimplemented step-up requirements fail closed.

Templates are copied atomically when a tenant is created; no user membership or elevated role assignment is created implicitly. Conversion aborts if live tenants exist, so pre-existing access is never silently reinterpreted. Browser database roles cannot read API client secret_hash.

The write/approval/audit APIs, dynamic condition evaluator and service/API-client authentication are not claimed complete here. This is their schema/authorization prerequisite. All 70 preceding DB tests must remain green alongside the new tests before promotion.
