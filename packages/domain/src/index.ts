export type TenantId = string & { readonly __brand: "TenantId" };
export type CanonicalEntityId = string & { readonly __brand: "CanonicalEntityId" };

export interface TenantScoped {
  tenantId: TenantId;
}
