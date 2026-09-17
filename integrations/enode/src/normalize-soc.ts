import { DomainError, entityId, record, utcInstant } from "@flexexa/domain";
import { externalIdentifier, parseProviderBinding } from "@flexexa/domain/connect";
import type { ConnectionScope, CanonicalSocObservation } from "@flexexa/domain/connect";

/** Only documented chargeState.batteryLevel/lastUpdated and cloud connectivity are mapped.
 * Other EV fields stay unimplemented until their versioned Enode schema is verified.
 * Input must be a full fetched vehicle, not a partial webhook patch.
 */
export function normalizeEnodeSoc(
  inputValue: unknown, bindingValue: unknown, scope: ConnectionScope, expectedEnodeUserId: string, receivedAt: unknown,
): CanonicalSocObservation {
  const input = record(inputValue), source = parseProviderBinding(bindingValue, scope);
  if (source.provider_key !== "enode") throw new DomainError("VALIDATION_ERROR");
  // Both identities come from a trusted account/asset mapping, not the incoming payload.
  if (externalIdentifier(input.id) !== source.external_asset_id ||
      externalIdentifier(input.userId) !== externalIdentifier(expectedEnodeUserId)) throw new DomainError("PERMISSION_DENIED");
  const state = input.chargeState === null || input.chargeState === undefined ? null : record(input.chargeState);
  const level = state?.batteryLevel;
  if (level !== null && level !== undefined && (typeof level !== "number" || !Number.isFinite(level) || level < 0 || level > 100)) {
    throw new DomainError("VALIDATION_ERROR");
  }
  const received_at = utcInstant(receivedAt);
  const observed = state?.lastUpdated == null ? null : utcInstant(state.lastUpdated);
  const lastSeen = input.lastSeen == null ? null : utcInstant(input.lastSeen);
  // Receiving a new response must never make old charge data fresh.
  if ((observed !== null && observed > received_at) || (lastSeen !== null && lastSeen > received_at)) throw new DomainError("VALIDATION_ERROR");
  if (input.isReachable != null && typeof input.isReachable !== "boolean") throw new DomainError("VALIDATION_ERROR");
  const soc = level == null ? null : level as number;
  return Object.freeze({ tenant_id: scope.tenant_id, asset_id: entityId(scope.asset_id), environment: source.environment, asset_type: "ev",
    soc_percent: soc, state_observed_at: observed, received_at,
    provider_cloud_reachable: input.isReachable == null ? null : input.isReachable as boolean,
    provider_last_seen_at: lastSeen, source, normalizer_version: "enode-soc/2",
    quality: soc !== null && observed !== null ? "reported" : "unknown",
  });
}
