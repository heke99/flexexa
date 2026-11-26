import { isCustomerResourceId } from "./customer-accounts.ts";

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

const products = new Set<unknown>(customerProductKeys);
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && timestampPattern.test(value) && Number.isFinite(Date.parse(value));
}

function isProductKey(value: unknown): value is CustomerProductKey {
  return products.has(value);
}

export function normalizeProductAccess(payload: unknown, now = Date.now()): CustomerProductAccess | null {
  if (!payload || typeof payload !== "object" || !("items" in payload) || !("requests" in payload) ||
    !Array.isArray(payload.items) || !Array.isArray(payload.requests) ||
    payload.items.length > products.size || payload.requests.length > products.size) return null;

  const items: CustomerProductAccess["items"] = [];
  const requests: CustomerProductAccess["requests"] = [];
  const granted = new Set<CustomerProductKey>();
  const requested = new Set<CustomerProductKey>();
  for (const item of payload.items) {
    if (!item || !isProductKey(item.product_key) || granted.has(item.product_key) ||
      (item.status !== "active" && item.status !== "revoked") || !Number.isSafeInteger(item.version) || item.version < 1 ||
      !(item.expires_at === null || isTimestamp(item.expires_at)) || typeof item.enabled !== "boolean" ||
      (item.enabled && (item.status !== "active" || (item.expires_at !== null && Date.parse(item.expires_at) <= now)))) return null;
    granted.add(item.product_key);
    items.push({ product_key: item.product_key, status: item.status, version: item.version,
      expires_at: item.expires_at, enabled: item.enabled });
  }
  for (const item of payload.requests) {
    if (!item || !isProductKey(item.product_key) || requested.has(item.product_key) || !isTimestamp(item.requested_at)) return null;
    requested.add(item.product_key);
    requests.push({ product_key: item.product_key, requested_at: item.requested_at });
  }
  return { items, requests };
}
