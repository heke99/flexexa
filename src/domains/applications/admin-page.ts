import { encodeApplicationCursor } from "./cursor.ts";

type AdminApplication = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  annual_miles: number;
  car: string;
  position: number | null;
  offer_group: "first_1000" | "following" | "test";
  marketing_consent: boolean;
  privacy_version: string;
  created_at: string;
  is_test: boolean;
  email_state: "pending" | "processing" | "sent" | "failed" | "review" | null;
  provider_id: string | null;
  last_error: string | null;
  attempts: number | null;
};

export type AdminApplicationPage = {
  count: number;
  base: number;
  new: number;
  applications: AdminApplication[];
  nextCursor: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && Number.isSafeInteger(value);
}

function isNullableText(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function parseApplication(value: unknown): AdminApplication | null {
  if (!isRecord(value)) return null;
  const { id, first_name, last_name, email, annual_miles, car, position, offer_group, marketing_consent,
    privacy_version, created_at, is_test, email_state, provider_id, last_error, attempts } = value;
  if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ||
    typeof first_name !== "string" || typeof last_name !== "string" || typeof email !== "string" ||
    !isCount(annual_miles) || typeof car !== "string" || !(position === null || isCount(position)) ||
    (offer_group !== "first_1000" && offer_group !== "following" && offer_group !== "test") ||
    typeof marketing_consent !== "boolean" || typeof privacy_version !== "string" ||
    typeof created_at !== "string" || !Number.isFinite(Date.parse(created_at)) || typeof is_test !== "boolean" ||
    (email_state !== null && email_state !== "pending" && email_state !== "processing" &&
      email_state !== "sent" && email_state !== "failed" && email_state !== "review") ||
    !isNullableText(provider_id) || !isNullableText(last_error) || !(attempts === null || isCount(attempts))) return null;
  return { id, first_name, last_name, email, annual_miles, car, position, offer_group, marketing_consent,
    privacy_version, created_at, is_test, email_state, provider_id, last_error, attempts };
}

export function parseAdminApplicationPage(value: unknown): AdminApplicationPage | null {
  if (!isRecord(value)) return null;
  const { count, base, new: newCount, applications, next } = value;
  if (!isCount(count) || !isCount(base) || !isCount(newCount) ||
    !Array.isArray(applications) || applications.length > 100) return null;
  const nextCursor = encodeApplicationCursor(next);
  if (next !== null && nextCursor === null) return null;
  const rows: AdminApplication[] = [];
  for (const item of applications) {
    const row = parseApplication(item);
    if (!row) return null;
    rows.push(row);
  }
  return { count, base, new: newCount, applications: rows, nextCursor };
}
