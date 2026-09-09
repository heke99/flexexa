import { DomainError, assertSameTenant, entityId, exactKeys, record, tenantId } from "@flexexa/domain";
import type { TenantId, ErrorCode } from "@flexexa/domain";
import { parseCreateCustomerRequest, parseCreateSiteRequest, parseCreateMeteringPointRequest, parseCreateAssetRequest,
  parseRegisterProviderAccountRequest, parseRevokeProviderAccountRequest, parseProviderAccountReceipt } from "@flexexa/api-contracts";
import type { MutationRequest, MutationReceipt, CoreResourceType } from "@flexexa/api-contracts";

export type FlexexaMutationRpc = "flexexa_create_customer" | "flexexa_create_site" | "flexexa_create_metering_point" |
  "flexexa_create_asset" | "flexexa_register_provider_account" | "flexexa_revoke_provider_account";
export interface RpcArguments {
  readonly p_tenant_id: TenantId;
  readonly p_payload: Readonly<Record<string, unknown>>;
  readonly p_idempotency_key: string;
  readonly p_correlation_id: string;
}
/** Inject an authenticated session-bound transport, never user-supplied credentials. */
export interface MutationRpcClient {
  rpc(name: FlexexaMutationRpc, args: RpcArguments): PromiseLike<{ data: unknown; error: unknown | null }>;
}
const SAFE_DATABASE_ERRORS = new Set<ErrorCode>(["VALIDATION_ERROR", "TENANT_MISMATCH", "IDEMPOTENCY_CONFLICT", "INVALID_STATE_TRANSITION", "PERMISSION_DENIED"]);
/** Database diagnostics may contain private identifiers or credentials. Never forward them. */
export function databaseError(value: unknown): DomainError {
  if (typeof value !== "object" || value === null) return new DomainError("INTERNAL_ERROR");
  const error = value as Record<string, unknown>;
  if (error.code === "42501") return new DomainError("PERMISSION_DENIED");
  if (error.code === "P0001" && typeof error.message === "string" && SAFE_DATABASE_ERRORS.has(error.message as ErrorCode)) return new DomainError(error.message as ErrorCode);
  return new DomainError("INTERNAL_ERROR");
}

function coreReceipt(value: unknown, request: MutationRequest<unknown>, kind: CoreResourceType): MutationReceipt {
  const p = record(value);
  exactKeys(p, ["tenant_id", "resource_type", "resource_id", "correlation_id", "idempotency_key", "status"]);
  assertSameTenant(request.tenant_id, p.tenant_id);
  if (p.resource_type !== kind || p.idempotency_key !== request.idempotency_key || p.status !== "created") throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ tenant_id: tenantId(p.tenant_id), resource_type: kind, resource_id: entityId(p.resource_id),
    correlation_id: entityId(p.correlation_id), idempotency_key: request.idempotency_key, status: "created" });
}
/**
 * No networking configuration, credentials, retry loop or generic SQL entrypoint.
 * expectedTenant comes from trusted authentication context, not the request body.
 * Database functions independently authorize every call, including durable replays.
 */
export function createFlexexaMutationApi(client: MutationRpcClient, expectedTenant: TenantId) {
  const tenant = tenantId(expectedTenant);
  async function invoke<R>(name: FlexexaMutationRpc, request: MutationRequest<unknown>, decode: (v: unknown) => R): Promise<R> {
    const args: RpcArguments = Object.freeze({ p_tenant_id: tenant, p_payload: record(request.payload),
      p_idempotency_key: request.idempotency_key, p_correlation_id: request.correlation_id });
    let result: unknown;
    try { result = await client.rpc(name, args); }
    catch { throw new DomainError("INTERNAL_ERROR"); }
    const response = record(result);
    if (response.error !== null && response.error !== undefined) throw databaseError(response.error);
    return decode(response.data);
  }
  function core<T>(name: FlexexaMutationRpc, kind: CoreResourceType, parse: (v: unknown, t: TenantId) => MutationRequest<T>) {
    return async (value: unknown) => {
      const request = parse(value, tenant);
      return invoke(name, request, result => coreReceipt(result, request, kind));
    };
  }
  return Object.freeze({
    createCustomer: core("flexexa_create_customer", "customer", parseCreateCustomerRequest),
    createSite: core("flexexa_create_site", "site", parseCreateSiteRequest),
    createMeteringPoint: core("flexexa_create_metering_point", "metering_point", parseCreateMeteringPointRequest),
    createAsset: core("flexexa_create_asset", "asset", parseCreateAssetRequest),
    async registerProviderAccount(value: unknown) {
      const request = parseRegisterProviderAccountRequest(value, tenant);
      return invoke("flexexa_register_provider_account", request, result => parseProviderAccountReceipt(result, request));
    },
    async revokeProviderAccount(value: unknown) {
      const request = parseRevokeProviderAccountRequest(value, tenant);
      return invoke("flexexa_revoke_provider_account", request, result => parseProviderAccountReceipt(result, request));
    },
  });
}
