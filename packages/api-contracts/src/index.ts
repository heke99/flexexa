import { DomainError, entityId, tenantId, assertSameTenant, record, text, exactKeys, assetType, decimalString, ianaTimezone } from "@flexexa/domain";
import type { TenantId, CanonicalEntityId, ErrorCode, AssetType, DecimalString } from "@flexexa/domain";
export interface ApiError { readonly code: ErrorCode; readonly message: string; readonly correlation_id: CanonicalEntityId }
export interface MutationRequest<TPayload> {
  readonly tenant_id: TenantId;
  readonly idempotency_key: string;
  readonly correlation_id: CanonicalEntityId;
  readonly payload: TPayload;
}
export interface MutationReceipt {
  readonly tenant_id: TenantId;
  readonly resource_type: CoreResourceType;
  readonly resource_id: CanonicalEntityId;
  readonly correlation_id: CanonicalEntityId;
  readonly idempotency_key: string;
  readonly status: "created";
}
export interface CreateCustomerPayload {
  readonly customer_type: "person" | "company";
  readonly display_name: string;
  readonly external_customer_id: string | null;
}
export interface CreateSitePayload {
  readonly customer_id: CanonicalEntityId;
  readonly name: string;
  readonly external_site_id: string | null;
  readonly country_code: string;
  readonly timezone: string;
}
export interface CreateMeteringPointPayload {
  readonly site_id: CanonicalEntityId;
  readonly external_metering_point_id: string;
  readonly metering_point_type: "consumption" | "production" | "bidirectional";
  readonly measurement_resolution_minutes: number;
  readonly market_area_id: CanonicalEntityId | null;
}
export interface CreateAssetPayload {
  readonly customer_id: CanonicalEntityId;
  readonly site_id: CanonicalEntityId;
  readonly asset_type: AssetType;
  readonly display_name: string;
  readonly external_id: string | null;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly rated_power_kw: DecimalString | null;
  readonly energy_capacity_kwh: DecimalString | null;
}
export type CoreResourceType = "customer" | "site" | "metering_point" | "asset";
const optionalText = (value: unknown): string | null => value === null || value === undefined ? null : text(value);
function boundedDecimal(value: unknown, wholeDigits: number): DecimalString | null {
  if (value === null || value === undefined) return null;
  const result = decimalString(value, 3);
  if ((result.split(".")[0] ?? "").length > wholeDigits) throw new DomainError("VALIDATION_ERROR");
  return result;
}
export function parseCreateCustomerPayload(value: unknown): CreateCustomerPayload {
  const p = record(value);
  exactKeys(p, ["customer_type", "display_name", "external_customer_id"]);
  if (p.customer_type !== "person" && p.customer_type !== "company") throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ customer_type: p.customer_type, display_name: text(p.display_name), external_customer_id: optionalText(p.external_customer_id) });
}
export function parseCreateSitePayload(value: unknown): CreateSitePayload {
  const p = record(value);
  exactKeys(p, ["customer_id", "name", "external_site_id", "country_code", "timezone"]);
  const country = p.country_code === undefined ? "SE" : p.country_code;
  if (typeof country !== "string" || country.length !== 2 || !/^[A-Z]{2}$/u.test(country)) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ customer_id: entityId(p.customer_id), name: text(p.name), external_site_id: optionalText(p.external_site_id),
    country_code: country, timezone: p.timezone === undefined ? "Europe/Stockholm" : ianaTimezone(p.timezone) });
}
export function parseCreateMeteringPointPayload(value: unknown): CreateMeteringPointPayload {
  const p = record(value);
  exactKeys(p, ["site_id", "external_metering_point_id", "metering_point_type", "measurement_resolution_minutes", "market_area_id"]);
  const kind = p.metering_point_type === undefined ? "consumption" : p.metering_point_type;
  if (kind !== "consumption" && kind !== "production" && kind !== "bidirectional") throw new DomainError("VALIDATION_ERROR");
  const resolution = p.measurement_resolution_minutes === undefined ? 15 : p.measurement_resolution_minutes;
  if (typeof resolution !== "number" || !Number.isInteger(resolution) || resolution < 1 || resolution > 1440) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ site_id: entityId(p.site_id), external_metering_point_id: text(p.external_metering_point_id), metering_point_type: kind,
    measurement_resolution_minutes: resolution, market_area_id: p.market_area_id === null || p.market_area_id === undefined ? null : entityId(p.market_area_id) });
}
export function parseCreateAssetPayload(value: unknown): CreateAssetPayload {
  const p = record(value);
  exactKeys(p, ["customer_id", "site_id", "asset_type", "display_name", "external_id", "manufacturer", "model", "rated_power_kw", "energy_capacity_kwh"]);
  return Object.freeze({ customer_id: entityId(p.customer_id), site_id: entityId(p.site_id), asset_type: assetType(p.asset_type), display_name: text(p.display_name),
    external_id: optionalText(p.external_id), manufacturer: optionalText(p.manufacturer), model: optionalText(p.model),
    rated_power_kw: boundedDecimal(p.rated_power_kw, 9), energy_capacity_kwh: boundedDecimal(p.energy_capacity_kwh, 11) });
}
/** expectedTenant is authenticated server context; the RPC reauthorizes independently. */
function parseMutation<T>(value: unknown, expectedTenant: TenantId, parsePayload: (value: unknown) => T): MutationRequest<T> {
  const input = record(value);
  exactKeys(input, ["tenant_id", "idempotency_key", "correlation_id", "payload"]);
  assertSameTenant(expectedTenant, input.tenant_id);
  const key = text(input.idempotency_key, 128);
  if (key !== input.idempotency_key || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(key)) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ tenant_id: tenantId(input.tenant_id), idempotency_key: key,
    correlation_id: entityId(input.correlation_id), payload: parsePayload(input.payload) });
}
export const parseCreateCustomerRequest = (v: unknown, t: TenantId): MutationRequest<CreateCustomerPayload> => parseMutation(v, t, parseCreateCustomerPayload);
export const parseCreateSiteRequest = (v: unknown, t: TenantId): MutationRequest<CreateSitePayload> => parseMutation(v, t, parseCreateSitePayload);
export const parseCreateMeteringPointRequest = (v: unknown, t: TenantId): MutationRequest<CreateMeteringPointPayload> => parseMutation(v, t, parseCreateMeteringPointPayload);
export const parseCreateAssetRequest = (v: unknown, t: TenantId): MutationRequest<CreateAssetPayload> => parseMutation(v, t, parseCreateAssetPayload);
export function publicError(error: unknown, correlationId: unknown): ApiError {
  const code = error instanceof DomainError ? error.code : "INTERNAL_ERROR";
  return { code, message: code, correlation_id: entityId(correlationId) };
}
