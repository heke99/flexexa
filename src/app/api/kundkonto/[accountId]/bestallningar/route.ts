import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { isCustomerResourceId } from "@/lib/customer-accounts";
import { customerOrderStates, type CustomerOrders } from "@/lib/customer-orders";

export const dynamic = "force-dynamic";

const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function normalizeCustomerOrders(payload: unknown): CustomerOrders | null {
  if (!payload || typeof payload !== "object" || !("items" in payload) ||
    !Array.isArray(payload.items) || payload.items.length > 10) return null;

  const items: CustomerOrders["items"] = [];
  const ids = new Set<string>();
  for (const item of payload.items) {
    if (!item || !isCustomerResourceId(item.id) || ids.has(item.id) || !customerOrderStates.includes(item.state) ||
      typeof item.created_at !== "string" || !timestamp.test(item.created_at) || !Number.isFinite(Date.parse(item.created_at))) return null;
    ids.add(item.id);

    const { agreement } = item;
    // The upstream only exposes a sealed recurring unit price for paid or refunded orders.
    const hasPrice = (item.state === "paid" || item.state === "refunded") && item.quantity === 1 &&
      Number.isSafeInteger(agreement?.amount_minor) && agreement.amount_minor > 0 &&
      typeof agreement.currency === "string" && agreement.currency.toLowerCase() === "sek";
    items.push({ id: item.id, state: item.state, createdAt: item.created_at,
      amountMinor: hasPrice ? agreement.amount_minor : null, currency: hasPrice ? "SEK" : null });
  }
  return { items };
}

export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await context.params;
  const path = isCustomerResourceId(accountId) ? `/v1/accounts/${accountId}/orders?limit=10` as const : null;
  return readCustomerAccountApi(request, path, normalizeCustomerOrders);
}
