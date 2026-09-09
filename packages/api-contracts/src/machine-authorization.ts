import { DomainError, assertSameTenant, exactKeys, record, tenantId } from "@flexexa/domain";
import { connectEnvironment } from "@flexexa/domain/connect";
import type { TenantId } from "@flexexa/domain";
import type { ConnectEnvironment } from "@flexexa/domain/connect";

export interface MachinePermissionScope {
  readonly tenant_id: TenantId;
  readonly environment: ConnectEnvironment;
}
/** Shape/scoping only. DB derives the machine from a verified live session, not input.
 * A true result is not an authorization ticket: the later resource mutation must
 * independently check authorization in its own transaction. Never cache this result.
 */
export function machinePermissionRpc(value: unknown, expected: MachinePermissionScope) {
  const input = record(value);
  exactKeys(input, ["tenant_id", "permission_key", "environment"]);
  const tenant = tenantId(expected.tenant_id), environment = connectEnvironment(expected.environment);
  assertSameTenant(tenant, input.tenant_id);
  if (connectEnvironment(input.environment) !== environment) throw new DomainError("PERMISSION_DENIED");
  if (typeof input.permission_key !== "string" || input.permission_key.length > 128 ||
      !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/u.test(input.permission_key) || input.permission_key.includes("\n")) {
    throw new DomainError("VALIDATION_ERROR");
  }
  return Object.freeze({ function_name: "flexexa_machine_has_permission" as const,
    args: Object.freeze({ p_tenant_id: tenant, p_permission_key: input.permission_key, p_environment: environment }) });
}
export function parseMachinePermissionResult(value: unknown): boolean {
  if (typeof value !== "boolean") throw new DomainError("VALIDATION_ERROR");
  return value;
}
