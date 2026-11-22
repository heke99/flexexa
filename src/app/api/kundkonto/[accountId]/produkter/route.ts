import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { customerProductKeys, productAccessPath, type CustomerProductAccess, type CustomerProductKey } from "@/lib/customer-product-access";

export const dynamic = "force-dynamic";

const products = new Set<unknown>(customerProductKeys);
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && timestampPattern.test(value) && Number.isFinite(Date.parse(value));
}

function isProductKey(value: unknown): value is CustomerProductKey {
  return products.has(value);
}

function normalizeProductAccess(payload: unknown): CustomerProductAccess | null {
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
      (item.enabled && item.status !== "active")) return null;
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

export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await context.params;
  return readCustomerAccountApi(request, productAccessPath(accountId), normalizeProductAccess);
}
