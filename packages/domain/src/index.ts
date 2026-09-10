/** Canonical primitives. Provider-specific spellings stop at adapter boundaries. */
export type TenantId = string & { readonly __brand: "TenantId" };
export type CanonicalEntityId = string & { readonly __brand: "CanonicalEntityId" };
export type UtcInstant = string & { readonly __brand: "UtcInstant" };
export type DecimalString = string & { readonly __brand: "DecimalString" };
export interface TenantScoped { readonly tenant_id: TenantId }
export const ASSET_TYPES = Object.freeze(["ev", "evse", "battery", "solar_inverter", "meter", "heat_pump", "hems", "hvac", "industrial_load", "generator", "other_der", "other_flexible_load"] as const);
export type AssetType = typeof ASSET_TYPES[number];
export const ERROR_CODES = Object.freeze(["VALIDATION_ERROR", "INTERNAL_ERROR", "TENANT_MISMATCH", "PERMISSION_DENIED", "POLICY_DENIED", "INVALID_STATE_TRANSITION", "CONSENT_REQUIRED", "ASSET_OFFLINE", "STALE_TELEMETRY", "CAPABILITY_UNSUPPORTED", "MOBILITY_GUARANTEE_BLOCK", "FLEX_ALREADY_RESERVED", "MARKET_INELIGIBLE", "PREQUALIFICATION_REQUIRED", "BSP_ROUTE_UNAVAILABLE", "SETTLEMENT_MISMATCH", "LEDGER_UNBALANCED", "PROVIDER_RATE_LIMITED", "IDEMPOTENCY_CONFLICT"] as const);
export type ErrorCode = typeof ERROR_CODES[number];
export class DomainError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string = code) { super(message); this.name = "DomainError"; this.code = code; }
}
export function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new DomainError("VALIDATION_ERROR");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 200): string {
  if (typeof value !== "string" || Array.from(value).length > max || value.trim().length === 0 || /[\uD800-\uDFFF]/u.test(value) || /[\u0000-\u001f\u007f]/u.test(value)) throw new DomainError("VALIDATION_ERROR");
  return value.trim();
}
export function exactKeys(value: Record<string, unknown>, keys: readonly string[]): void {
  if (Object.keys(value).some(k => !keys.includes(k))) throw new DomainError("VALIDATION_ERROR");
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export function entityId(value: unknown): CanonicalEntityId {
  if (typeof value !== "string" || value.length !== 36 || !UUID.test(value)) throw new DomainError("VALIDATION_ERROR");
  return value.toLowerCase() as CanonicalEntityId;
}
export function tenantId(value: unknown): TenantId { return entityId(value) as string as TenantId; }
export function assertSameTenant(expected: TenantId, actual: unknown): void {
  if (tenantId(actual) !== expected) throw new DomainError("TENANT_MISMATCH");
}
export function assetType(value: unknown): AssetType {
  if (typeof value !== "string" || !(ASSET_TYPES as readonly string[]).includes(value)) throw new DomainError("VALIDATION_ERROR");
  return value as AssetType;
}
export function utcInstant(value: unknown): UtcInstant {
  if (typeof value !== "string") throw new DomainError("VALIDATION_ERROR");
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/u.exec(value);
  if (!match || value.startsWith("0000")) throw new DomainError("VALIDATION_ERROR");
  const normalized = `${match[1]}.${(match[2] ?? "").padEnd(3, "0")}Z`;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== normalized) throw new DomainError("VALIDATION_ERROR");
  return normalized as UtcInstant;
}
export function interval(startsAt: unknown, endsAt: unknown): { starts_at: UtcInstant; ends_at: UtcInstant } {
  const starts_at = utcInstant(startsAt), ends_at = utcInstant(endsAt);
  if (starts_at >= ends_at) throw new DomainError("VALIDATION_ERROR");
  return { starts_at, ends_at };
}
export function decimalString(value: unknown, scale = 6, allowNegative = false): DecimalString {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18 || typeof value !== "string" || value.trim() !== value || value.length > 80 || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u.test(value)) throw new DomainError("VALIDATION_ERROR");
  const negative = value.startsWith("-"), absolute = negative ? value.slice(1) : value;
  const [whole = "0", fraction = ""] = absolute.split(".");
  if (fraction.length > scale || (negative && !allowNegative)) throw new DomainError("VALIDATION_ERROR");
  const cleaned = fraction.replace(/0+$/u, "");
  const isZero = /^0+$/u.test(whole) && cleaned === "";
  return `${negative && !isZero ? "-" : ""}${whole}${cleaned ? `.${cleaned}` : ""}` as DecimalString;
}
export function minorUnits(value: unknown, scale: number): bigint {
  const normalized = decimalString(value, scale, true);
  const negative = normalized.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? normalized.slice(1) : normalized).split(".");
  const units = BigInt(whole) * 10n ** BigInt(scale) + BigInt(fraction.padEnd(scale, "0") || "0");
  return negative ? -units : units;
}
export function ianaTimezone(value: unknown): string {
  const result = text(value, 100);
  try { new Intl.DateTimeFormat("en", { timeZone: result }).format(0); } catch { throw new DomainError("VALIDATION_ERROR"); }
  return result;
}
