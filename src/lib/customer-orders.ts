import { isCustomerResourceId } from "./customer-accounts.ts";

export const customerOrderStates = ["pending", "paid", "blocked", "refunded"] as const;

export type CustomerOrder = {
  id: string;
  state: typeof customerOrderStates[number];
  createdAt: string;
  amountMinor: number | null;
  currency: "SEK" | null;
};

export type CustomerOrders = { items: CustomerOrder[] };

const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function normalizeCustomerOrders(payload: unknown): CustomerOrders | null {
  if (!payload || typeof payload !== "object" || !("items" in payload) ||
    !Array.isArray(payload.items) || payload.items.length > 10) return null;

  const items: CustomerOrder[] = [];
  const ids = new Set<string>();
  for (const item of payload.items) {
    if (!item || !isCustomerResourceId(item.id) || ids.has(item.id.toLowerCase()) || !customerOrderStates.includes(item.state) ||
      typeof item.created_at !== "string" || !timestamp.test(item.created_at) || !Number.isFinite(Date.parse(item.created_at)) ||
      (item.quantity !== undefined && (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100))) return null;
    ids.add(item.id.toLowerCase());

    // Older/prepaid orders may lack a sealed agreement. Any present agreement must have a valid price pair.
    const { agreement } = item;
    if (agreement != null && (typeof agreement !== "object" || Array.isArray(agreement) ||
      !Number.isSafeInteger(agreement.amount_minor) || agreement.amount_minor <= 0 ||
      typeof agreement.currency !== "string" || agreement.currency.toLowerCase() !== "sek")) return null;
    const amountMinor = agreement != null && (item.state === "paid" || item.state === "refunded") && item.quantity === 1
      ? agreement.amount_minor : null;
    items.push({ id: item.id, state: item.state, createdAt: item.created_at, amountMinor,
      currency: amountMinor === null ? null : "SEK" });
  }
  return { items };
}
