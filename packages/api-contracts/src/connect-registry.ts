import { DomainError, assertSameTenant, entityId, exactKeys, record, tenantId } from "@flexexa/domain";
import { parseConnectionRoute, connectEnvironment } from "@flexexa/domain/connect";
import type { ConnectionRouteSnapshot, ConnectionScope } from "@flexexa/domain/connect";

/** Server supplies the expected tenant, asset AND environment after authentication.
 * This contract validates shape/binding only; PostgreSQL independently authorizes reads.
 */
export function parseConnectionRouteRead(value: unknown, expected: ConnectionScope): ConnectionScope {
  const input = record(value);
  exactKeys(input, ["tenant_id", "asset_id", "environment"]);
  const tenant = tenantId(expected.tenant_id), asset = entityId(expected.asset_id);
  const environment = connectEnvironment(expected.environment);
  assertSameTenant(tenant, input.tenant_id);
  if (entityId(input.asset_id) !== asset || connectEnvironment(input.environment) !== environment) {
    throw new DomainError("PERMISSION_DENIED");
  }
  return Object.freeze({ tenant_id: tenant, asset_id: asset, environment });
}
export function connectionRouteReadRpc(value: unknown, expected: ConnectionScope) {
  const request = parseConnectionRouteRead(value, expected);
  return Object.freeze({ function_name: "flexexa_get_connection_routes" as const,
    args: Object.freeze({ p_tenant_id: request.tenant_id, p_asset_id: request.asset_id,
      p_environment: request.environment }) });
}
/** Accept only the complete, bounded canonical array. No secret/vendor fields or truncation. */
export function parseConnectionRouteReadResult(value: unknown, expected: ConnectionScope): readonly ConnectionRouteSnapshot[] {
  const scope = parseConnectionRouteRead(expected, expected);
  if (!Array.isArray(value) || value.length > 1000) throw new DomainError("VALIDATION_ERROR");
  const result = Array.from(value, row => parseConnectionRoute(row, scope));
  if (new Set(result.map(row => row.connection_id)).size !== result.length) throw new DomainError("VALIDATION_ERROR");
  return Object.freeze(result);
}
