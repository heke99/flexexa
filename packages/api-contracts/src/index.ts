import { DomainError, entityId, tenantId, assertSameTenant, record, text, exactKeys } from "@flexexa/domain";
import type { TenantId, CanonicalEntityId, ErrorCode } from "@flexexa/domain";
export interface ApiError { readonly code: ErrorCode; readonly message: string; readonly correlation_id: CanonicalEntityId }
export interface MutationRequest<TPayload> {
  readonly tenant_id: TenantId;
  readonly idempotency_key: string;
  readonly correlation_id: CanonicalEntityId;
  readonly payload: TPayload;
}
export interface CreateCustomerPayload {
  readonly customer_type: "person" | "company";
  readonly display_name: string;
  readonly external_customer_id: string | null;
}
/** expectedTenant comes from authenticated server context, never just a hostname/body. */
export function parseCreateCustomerRequest(value: unknown, expectedTenant: TenantId): MutationRequest<CreateCustomerPayload> {
  const input = record(value);
  exactKeys(input, ["tenant_id", "idempotency_key", "correlation_id", "payload"]);
  assertSameTenant(expectedTenant, input.tenant_id);
  const payload = record(input.payload);
  exactKeys(payload, ["customer_type", "display_name", "external_customer_id"]);
  if (typeof payload.customer_type !== "string" || !["person", "company"].includes(payload.customer_type)) throw new DomainError("VALIDATION_ERROR");
  const key = text(input.idempotency_key,128);
  if (key !== input.idempotency_key || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(key)) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ tenant_id: tenantId(input.tenant_id), idempotency_key: key,
    correlation_id: entityId(input.correlation_id), payload: Object.freeze({
      customer_type: payload.customer_type as "person" | "company", display_name: text(payload.display_name),
      external_customer_id: payload.external_customer_id === null || payload.external_customer_id === undefined ? null : text(payload.external_customer_id,200),
    }),
  });
}
export function publicError(error: unknown, correlationId: unknown): ApiError {
  const code = error instanceof DomainError ? error.code : "INTERNAL_ERROR";
  return { code, message: code, correlation_id: entityId(correlationId) };
}
