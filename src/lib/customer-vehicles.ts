const pageSize = 25;
const uuid = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

export type CustomerVehicle = { id: string; country: string; plate: string; verified_at: string | null };
export type CustomerVehiclePage = { items: CustomerVehicle[]; nextCursor: string | null };
export type CustomerVehicleListPath = `/v1/accounts/${string}/vehicles?limit=25${"" | `&after=${string}`}`;

function isCursor(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,512}$/.test(value);
}

export function customerVehicleListPath(accountId: string, query: URLSearchParams): CustomerVehicleListPath | null {
  if (!uuid.test(accountId)) return null;
  if (query.size === 0) return `/v1/accounts/${accountId}/vehicles?limit=${pageSize}`;
  const after = query.get("after");
  return query.size === 1 && isCursor(after)
    ? `/v1/accounts/${accountId}/vehicles?limit=${pageSize}&after=${after}` : null;
}

export function normalizeCustomerVehicles(payload: unknown): CustomerVehiclePage | null {
  if (!payload || typeof payload !== "object" || !("items" in payload) || !("nextCursor" in payload) ||
    !Array.isArray(payload.items) || payload.items.length > pageSize ||
    !(payload.nextCursor === null || (isCursor(payload.nextCursor) && payload.items.length === pageSize))) return null;

  const items: CustomerVehicle[] = [];
  const ids = new Set<string>();
  for (const item of payload.items) {
    if (!item || typeof item.id !== "string" || !uuid.test(item.id) || ids.has(item.id) ||
      typeof item.country !== "string" || !/^[A-Z]{2}$/.test(item.country) ||
      typeof item.plate !== "string" || item.plate.length < 2 || item.plate.length > 16 ||
      !(item.verified_at === null || (typeof item.verified_at === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(item.verified_at) &&
        Number.isFinite(Date.parse(item.verified_at))))) return null;
    ids.add(item.id);
    items.push({ id: item.id, country: item.country, plate: item.plate, verified_at: item.verified_at });
  }
  return { items, nextCursor: payload.nextCursor };
}
