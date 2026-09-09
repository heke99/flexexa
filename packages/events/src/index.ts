import { DomainError, entityId, tenantId, assertSameTenant, utcInstant, record, text, exactKeys } from "@flexexa/domain";
import type { TenantId, CanonicalEntityId, UtcInstant } from "@flexexa/domain";
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export interface CanonicalEventEnvelope<TPayload extends JsonValue = JsonValue> {
  readonly event_id: CanonicalEntityId;
  readonly event_type: string;
  readonly event_version: number;
  readonly occurred_at: UtcInstant;
  readonly received_at: UtcInstant;
  readonly tenant_id: TenantId;
  readonly organization_id: CanonicalEntityId | null;
  readonly correlation_id: CanonicalEntityId;
  readonly causation_id: CanonicalEntityId | null;
  readonly source: string;
  readonly payload: TPayload;
}
function jsonValue(value: unknown, depth = 0, budget = { remaining: 10000 }): JsonValue {
  if (depth > 32 || --budget.remaining < 0) throw new DomainError("VALIDATION_ERROR");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(v => jsonValue(v, depth + 1, budget));
  const source = record(value), result: Record<string, JsonValue> = Object.create(null);
  for (const [key, v] of Object.entries(source)) {
    if (["__proto__", "prototype", "constructor"].includes(key)) throw new DomainError("VALIDATION_ERROR");
    result[key] = jsonValue(v, depth + 1, budget);
  }
  return result;
}
/** Validates tenant events. Global catalog events require a separate contract. */
export function parseTenantEvent(value: unknown, expectedTenantId: TenantId): CanonicalEventEnvelope {
  const input = record(value);
  exactKeys(input, ["event_id","event_type","event_version","occurred_at","received_at","tenant_id","organization_id","correlation_id","causation_id","source","payload"]);
  assertSameTenant(expectedTenantId, input.tenant_id);
  const event_type = text(input.event_type, 120);
  if (!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/u.test(event_type) || !Number.isSafeInteger(input.event_version) || Number(input.event_version) < 1) throw new DomainError("VALIDATION_ERROR");
  const payload = jsonValue(input.payload);
  if (JSON.stringify(payload).length > 262144) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({
    event_id: entityId(input.event_id), event_type, event_version: input.event_version as number,
    occurred_at: utcInstant(input.occurred_at), received_at: utcInstant(input.received_at),
    tenant_id: tenantId(input.tenant_id), organization_id: input.organization_id === null ? null : entityId(input.organization_id),
    correlation_id: entityId(input.correlation_id), causation_id: input.causation_id === null ? null : entityId(input.causation_id),
    source: text(input.source, 100), payload,
  });
}
