import { isCustomerResourceId } from "./customer-accounts";

const sessionStatuses = ["pending", "uncertain", "charging", "stopping", "completed", "failed"] as const;
const timestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export type CustomerSession = {
  id: string;
  status: typeof sessionStatuses[number];
  createdAt: string;
  updatedAt: string;
};

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && timestamp.test(value) && Number.isFinite(Date.parse(value));
}

export function normalizeCustomerSession(payload: unknown): CustomerSession | null {
  if (!payload || typeof payload !== "object" || !("id" in payload) || !("status" in payload) ||
    !("created_at" in payload) || !("updated_at" in payload) || !isCustomerResourceId(payload.id) ||
    !isTimestamp(payload.created_at) || !isTimestamp(payload.updated_at)) return null;
  const status = sessionStatuses.find(value => value === payload.status);
  if (!status) return null;
  return { id: payload.id, status, createdAt: payload.created_at, updatedAt: payload.updated_at };
}

export function normalizeCustomerSessions(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("items" in payload) ||
    !Array.isArray(payload.items) || payload.items.length > 10) return null;

  const items: CustomerSession[] = [];
  const ids = new Set<string>();
  for (const entry of payload.items) {
    const item = normalizeCustomerSession(entry);
    if (!item || ids.has(item.id)) return null;
    ids.add(item.id);
    items.push(item);
  }
  return { items };
}
