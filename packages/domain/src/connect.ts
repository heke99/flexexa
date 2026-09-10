import { DomainError, assertSameTenant, entityId, exactKeys, record, text, utcInstant } from "@flexexa/domain";
import type { CanonicalEntityId, TenantId, UtcInstant } from "@flexexa/domain";

/** Shared connection contracts. No Enode/OEM wire models belong in this module. */
export const CONNECT_CAPABILITIES = Object.freeze([
  "read_soc", "start_charge", "stop_charge", "set_power_limit", "set_current_limit",
  "schedule_charge", "read_power", "read_energy", "battery_charge", "battery_discharge",
  "export_to_grid", "solar_read", "v1g", "v2g", "v2h",
] as const);
export type ConnectCapability = typeof CONNECT_CAPABILITIES[number];
export type ConnectionHealth = "healthy" | "degraded" | "unavailable" | "unknown";
export interface AssetScope { readonly tenant_id: TenantId; readonly asset_id: CanonicalEntityId }
export type ConnectEnvironment = "sandbox" | "production";
export interface ConnectionScope extends AssetScope { readonly environment: ConnectEnvironment }
export function connectEnvironment(value: unknown): ConnectEnvironment {
  if (value !== "sandbox" && value !== "production") throw new DomainError("VALIDATION_ERROR");
  return value;
}
export interface ProviderBinding extends ConnectionScope {
  readonly connection_id: CanonicalEntityId;
  readonly provider_id: CanonicalEntityId;
  readonly provider_account_id: CanonicalEntityId;
  readonly provider_key: string;
  readonly external_asset_id: string;
}
/** A joined, authenticated read model; not a replacement database schema. */
export interface ConnectionRouteSnapshot extends ProviderBinding {
  readonly priority: number;
  readonly connection_status: "connected" | "disconnected" | "revoked" | "pending" | "error";
  readonly account_status: "connected" | "disconnected" | "revoked" | "pending" | "error";
  readonly provider_status: "active" | "suspended";
  readonly health: ConnectionHealth;
  readonly capabilities: readonly ConnectCapability[];
  readonly capabilities_verified_at: UtcInstant | null;
  readonly last_seen_at: UtcInstant | null;
  readonly state_observed_at: UtcInstant | null;
  readonly valid_from: UtcInstant;
  readonly valid_until: UtcInstant | null;
}
export function externalIdentifier(value: unknown): string {
  const result = text(value, 512);
  if (result !== value) throw new DomainError("VALIDATION_ERROR");
  return result;
}
export function connectCapability(value: unknown): ConnectCapability {
  if (typeof value !== "string" || !(CONNECT_CAPABILITIES as readonly string[]).includes(value)) {
    throw new DomainError("CAPABILITY_UNSUPPORTED");
  }
  return value as ConnectCapability;
}
export function providerKey(value: unknown): string {
  const result = text(value, 80);
  if (result !== value || !/^[a-z][a-z0-9_]*$/u.test(result)) throw new DomainError("VALIDATION_ERROR");
  return result;
}
export function parseProviderBinding(value: unknown, scope: ConnectionScope): ProviderBinding {
  const input = record(value);
  assertSameTenant(scope.tenant_id, input.tenant_id);
  const environment = connectEnvironment(input.environment);
  if (environment !== connectEnvironment(scope.environment)) throw new DomainError("PERMISSION_DENIED");
  const asset_id = entityId(input.asset_id);
  if (asset_id !== entityId(scope.asset_id)) throw new DomainError("PERMISSION_DENIED");
  return Object.freeze({
    tenant_id: scope.tenant_id, asset_id, environment, connection_id: entityId(input.connection_id),
    provider_id: entityId(input.provider_id), provider_account_id: entityId(input.provider_account_id),
    provider_key: providerKey(input.provider_key), external_asset_id: externalIdentifier(input.external_asset_id),
  });
}
/** Provider IDs cannot replace canonical asset IDs; external IDs are account-scoped. */
export function providerExternalIdentity(binding: ProviderBinding): string {
  const clean = parseProviderBinding(binding, binding);
  return JSON.stringify([clean.tenant_id, clean.provider_id, clean.provider_account_id, clean.environment, clean.external_asset_id]);
}
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) throw new DomainError("VALIDATION_ERROR");
  return value as T;
}
export function parseConnectionRoute(value: unknown, scope: ConnectionScope): ConnectionRouteSnapshot {
  const input = record(value);
  exactKeys(input, ["tenant_id", "asset_id", "connection_id", "provider_id", "provider_account_id",
    "provider_key", "environment", "external_asset_id", "priority", "connection_status", "account_status", "provider_status",
    "health", "capabilities", "capabilities_verified_at", "last_seen_at", "state_observed_at", "valid_from", "valid_until"]);
  if (!Number.isSafeInteger(input.priority) || Number(input.priority) < 0 || Number(input.priority) > 2147483647) throw new DomainError("VALIDATION_ERROR");
  if (!Array.isArray(input.capabilities) || input.capabilities.length > CONNECT_CAPABILITIES.length) {
    throw new DomainError("VALIDATION_ERROR");
  }
  const capabilities = input.capabilities.map(connectCapability);
  if (new Set(capabilities).size !== capabilities.length) throw new DomainError("VALIDATION_ERROR");
  const valid_from = utcInstant(input.valid_from);
  const valid_until = input.valid_until === null ? null : utcInstant(input.valid_until);
  if (valid_until !== null && valid_until <= valid_from) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ ...parseProviderBinding(input, scope), priority: input.priority as number,
    connection_status: choice(input.connection_status, ["connected", "disconnected", "revoked", "pending", "error"]),
    account_status: choice(input.account_status, ["connected", "disconnected", "revoked", "pending", "error"]),
    provider_status: choice(input.provider_status, ["active", "suspended"]),
    health: choice(input.health, ["healthy", "degraded", "unavailable", "unknown"]),
    capabilities: Object.freeze(capabilities),
    capabilities_verified_at: input.capabilities_verified_at === null ? null : utcInstant(input.capabilities_verified_at),
    last_seen_at: input.last_seen_at === null ? null : utcInstant(input.last_seen_at),
    state_observed_at: input.state_observed_at === null ? null : utcInstant(input.state_observed_at),
    valid_from, valid_until,
  });
}
/** A partial observation never implies that unknown EV fields equal zero or false. */
export interface CanonicalSocObservation extends ConnectionScope {
  readonly asset_type: "ev";
  readonly soc_percent: number | null;
  readonly state_observed_at: UtcInstant | null;
  readonly received_at: UtcInstant;
  readonly provider_cloud_reachable: boolean | null;
  readonly provider_last_seen_at: UtcInstant | null;
  readonly source: ProviderBinding;
  readonly normalizer_version: string;
  readonly quality: "reported" | "unknown";
}
/** Compile-time port only. Authorization, durable inbox/outbox and locking live in services/DB. */
export interface DeviceReadProvider<TState> {
  readonly key: string;
  getState(binding: ProviderBinding, signal: AbortSignal): Promise<TState>;
  getCapabilities(binding: ProviderBinding, signal: AbortSignal): Promise<readonly ConnectCapability[]>;
}
export type VehicleProvider = DeviceReadProvider<CanonicalSocObservation>;
