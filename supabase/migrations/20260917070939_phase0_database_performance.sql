-- Forward-only Phase 0 performance change. No row, FK, grant or helper changes.
-- Deployment uses one transaction; bound lock waits and abort rather than block traffic.
-- Large populated deployments must plan an online/concurrent build separately.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

-- Cover child-side FK lookups, including catalog/audit references.
-- Role-first indexes support both global UUID lookups and full (tenant_id, role_id)
-- equality lookups; existing tenant-first membership indexes remain in place.
create index api_client_permissions_permission_idx on public.api_client_permissions(permission_id);
create index api_clients_created_by_idx on public.api_clients(created_by);
create index assets_tenant_site_customer_idx on public.assets(tenant_id, site_id, customer_id);
create index inbox_organization_tenant_idx on public.inbox_events(organization_id, tenant_id);
create index overrides_approved_by_idx on public.membership_permission_overrides(approved_by);
create index overrides_created_by_idx on public.membership_permission_overrides(created_by);
create index overrides_permission_idx on public.membership_permission_overrides(permission_id);
create index membership_roles_created_by_idx on public.membership_roles(created_by);
create index membership_roles_role_tenant_idx on public.membership_roles(role_id, tenant_id);
create index memberships_invited_by_idx on public.memberships(invited_by);
create index outbox_organization_tenant_idx on public.outbox_events(organization_id, tenant_id);
create index permission_aliases_canonical_idx on public.permission_aliases(canonical_permission_id);
create index platform_membership_roles_role_idx on public.platform_membership_roles(role_id);
create index role_permissions_permission_idx on public.role_permissions(permission_id);
create index role_permissions_role_tenant_idx on public.role_permissions(role_id, tenant_id);
create index role_template_permissions_permission_idx on public.role_template_permissions(permission_id);
create index roles_template_idx on public.roles(role_template_id);
create index service_identity_grants_permission_idx on public.service_identity_tenant_grants(permission_id);
create index tenants_market_area_idx on public.tenants(default_market_area_id);

-- These three non-unique indexes are exact leading prefixes of their replacements.
-- Create replacements first; do not discard other indexes merely because dev is empty.
drop index public.assets_tenant_site_idx;
drop index public.inbox_organization_idx;
drop index public.outbox_organization_idx;

-- A UNIQUE (tenant_id, request_id) already bounds a provisioning-completion lookup
-- to at most one row. Do not add a redundant (tenant_id, request_id, lease_id) index.
-- Existing null-only partial FK indexes remain: equality implies their predicates.

-- Cache only the statement-constant user identifier, never a tenant-dependent
-- authorization result. Keep policy names, roles and all original OR branches.
alter policy memberships_self_or_authorized_read on public.memberships
  using (user_id = (select auth.uid())
    or private.flexexa_has_permission(tenant_id, 'membership.read')
    or private.flexexa_is_platform_admin());
alter policy platform_memberships_self_or_platform_read on public.platform_memberships
  using (user_id = (select auth.uid()) or private.flexexa_is_platform_admin());
