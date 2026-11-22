import { isCustomerResourceId } from "./customer-accounts";

export const customerProductKeys = [
  "charging_subscription", "electricity_contract", "energy_optimization", "grid_rewards", "external_api",
] as const;

export type CustomerProductKey = typeof customerProductKeys[number];

export const requestedProducts = ["charging_subscription", "energy_optimization"] as const;
export type RequestedProductKey = typeof requestedProducts[number];

export function isRequestedProduct(value: string): value is RequestedProductKey {
  return requestedProducts.some(key => key === value);
}

export function productAccessPath(accountId: string) {
  return isCustomerResourceId(accountId) ? `/v1/accounts/${accountId}/product-access` as const : null;
}

export type CustomerProductAccess = {
  items: Array<{
    product_key: CustomerProductKey;
    status: "active" | "revoked";
    version: number;
    expires_at: string | null;
    enabled: boolean;
  }>;
  requests: Array<{
    product_key: CustomerProductKey;
    requested_at: string;
  }>;
};
