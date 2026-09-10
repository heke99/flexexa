import { DomainError, assertSameTenant, entityId, exactKeys, record, tenantId } from "@flexexa/domain";
import { connectEnvironment } from "@flexexa/domain/connect";
import { parseMutation } from "@flexexa/api-contracts";
import type { MachinePermissionScope } from "@flexexa/api-contracts/machine-authorization";
import { databaseError } from "@flexexa/api-contracts/rpc";

export type IdentityAdministration = "enroll" | "revoke";
export function identityAdministrationRpc(kind: IdentityAdministration, value: unknown, scope: MachinePermissionScope) {
  const tenant = tenantId(scope.tenant_id), environment = connectEnvironment(scope.environment);
  if (kind !== "enroll" && kind !== "revoke") throw new DomainError("VALIDATION_ERROR");
  const request = parseMutation(value, tenant, raw => {
    const p = record(raw);
    if (connectEnvironment(p.environment) !== environment) throw new DomainError("PERMISSION_DENIED");
    if (kind === "enroll") {
      exactKeys(p, ["api_client_id", "auth_user_id", "environment"]);
      return Object.freeze({ api_client_id: entityId(p.api_client_id), auth_user_id: entityId(p.auth_user_id), environment });
    }
    exactKeys(p, ["principal_id", "environment", "reason_code"]);
    const reason = p.reason_code;
    if (reason !== "security" && reason !== "rotation" && reason !== "administrative") throw new DomainError("VALIDATION_ERROR");
    return Object.freeze({ principal_id: entityId(p.principal_id), environment, reason_code: reason });
  });
  return Object.freeze({
    function_name: kind === "enroll" ? "flexexa_enroll_api_client_identity" as const : "flexexa_revoke_api_client_identity" as const,
    args: Object.freeze({ p_tenant_id: request.tenant_id, p_payload: request.payload,
      p_idempotency_key: request.idempotency_key, p_correlation_id: request.correlation_id }),
  });
}
/** A receipt is a historical fact, not current authorization or a bearer credential. */
export function parseIdentityAdministrationReceipt(value: unknown, call: ReturnType<typeof identityAdministrationRpc>) {
  const p = record(value);
  exactKeys(p, ["tenant_id", "resource_type", "resource_id", "correlation_id", "idempotency_key", "environment", "status"]);
  assertSameTenant(call.args.p_tenant_id, p.tenant_id);
  const expected = call.function_name === "flexexa_enroll_api_client_identity" ? "enrolled" : "revoked";
  if (p.status !== expected || p.resource_type !== "machine_principal" || p.idempotency_key !== call.args.p_idempotency_key ||
      connectEnvironment(p.environment) !== call.args.p_payload.environment) throw new DomainError("VALIDATION_ERROR");
  const resource_id = entityId(p.resource_id);
  if (call.function_name === "flexexa_revoke_api_client_identity" && (!("principal_id" in call.args.p_payload) || resource_id !== call.args.p_payload.principal_id)) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ tenant_id: call.args.p_tenant_id, resource_type: "machine_principal" as const, resource_id,
    correlation_id: entityId(p.correlation_id), idempotency_key: call.args.p_idempotency_key,
    environment: call.args.p_payload.environment, status: expected });
}

type IdentityCall = ReturnType<typeof identityAdministrationRpc>;
/** An existing MFA administrator session; never the privileged Auth provisioning client. */
export interface IdentityAdministrationClient {
  rpc(name: IdentityCall["function_name"], args: IdentityCall["args"]): PromiseLike<{ data: unknown; error: unknown | null }>;
}
/**
 * Enrollment/revocation only. Does not create Auth users, deliver credentials or grant rights.
 * Scope is copied from trusted context. SQL rechecks current authority on every invocation.
 * Ambiguous network failures are never automatically retried or compensated by deleting users.
 */
export function createIdentityAdministrationApi(client: IdentityAdministrationClient, expectedScope: MachinePermissionScope) {
  const scope = Object.freeze({ tenant_id: tenantId(expectedScope.tenant_id), environment: connectEnvironment(expectedScope.environment) });
  async function invoke(kind: IdentityAdministration, value: unknown) {
    const call = identityAdministrationRpc(kind, value, scope);
    let result: unknown;
    try { result = await client.rpc(call.function_name, call.args); }
    catch { throw new DomainError("INTERNAL_ERROR"); }
    const response = record(result);
    if (response.error !== null && response.error !== undefined) throw databaseError(response.error);
    return parseIdentityAdministrationReceipt(response.data, call);
  }
  return Object.freeze({
    enroll: (value: unknown) => invoke("enroll", value),
    revoke: (value: unknown) => invoke("revoke", value),
  });
}

/** Records intent only; the database generates both the operation and intended Auth identity. */
export function identityProvisioningRequestRpc(value: unknown, expectedScope: MachinePermissionScope) {
  const tenant = tenantId(expectedScope.tenant_id), environment = connectEnvironment(expectedScope.environment);
  const request = parseMutation(value, tenant, raw => {
    const p = record(raw);
    exactKeys(p, ["api_client_id", "environment"]);
    if (connectEnvironment(p.environment) !== environment) throw new DomainError("PERMISSION_DENIED");
    return Object.freeze({ api_client_id: entityId(p.api_client_id), environment });
  });
  return Object.freeze({ function_name: "flexexa_request_api_identity_provisioning" as const,
    args: Object.freeze({ p_tenant_id: request.tenant_id, p_payload: request.payload,
      p_idempotency_key: request.idempotency_key, p_correlation_id: request.correlation_id }) });
}
type ProvisioningRequestCall = ReturnType<typeof identityProvisioningRequestRpc>;
export function parseIdentityProvisioningRequestReceipt(value: unknown, call: ProvisioningRequestCall) {
  const p = record(value);
  exactKeys(p, ["tenant_id", "resource_type", "resource_id", "api_client_id", "intended_auth_user_id", "environment", "correlation_id", "idempotency_key", "status"]);
  assertSameTenant(call.args.p_tenant_id, p.tenant_id);
  if (p.resource_type !== "identity_provisioning_request" || p.status !== "requested" || p.idempotency_key !== call.args.p_idempotency_key ||
      entityId(p.api_client_id) !== call.args.p_payload.api_client_id || connectEnvironment(p.environment) !== call.args.p_payload.environment) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ tenant_id: call.args.p_tenant_id, resource_type: "identity_provisioning_request" as const,
    resource_id: entityId(p.resource_id), api_client_id: call.args.p_payload.api_client_id,
    intended_auth_user_id: entityId(p.intended_auth_user_id), environment: call.args.p_payload.environment,
    correlation_id: entityId(p.correlation_id), idempotency_key: call.args.p_idempotency_key, status: "requested" as const });
}
export interface IdentityProvisioningRequestClient {
  rpc(name: ProvisioningRequestCall["function_name"], args: ProvisioningRequestCall["args"]): PromiseLike<{ data: unknown; error: unknown | null }>;
}
/** An expiring durable intent is never permission for an Auth admin API call. */
export function createIdentityProvisioningRequestApi(client: IdentityProvisioningRequestClient, expectedScope: MachinePermissionScope) {
  const scope = Object.freeze({ tenant_id: tenantId(expectedScope.tenant_id), environment: connectEnvironment(expectedScope.environment) });
  return Object.freeze({ async request(value: unknown) {
    const call = identityProvisioningRequestRpc(value, scope);
    let result: unknown;
    try { result = await client.rpc(call.function_name, call.args); }
    catch { throw new DomainError("INTERNAL_ERROR"); }
    const response = record(result);
    if (response.error !== null && response.error !== undefined) throw databaseError(response.error);
    return parseIdentityProvisioningRequestReceipt(response.data, call);
  } });
}
