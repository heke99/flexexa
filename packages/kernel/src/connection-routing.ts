import { DomainError, entityId, exactKeys, record, utcInstant } from "@flexexa/domain";
import { connectCapability, parseConnectionRoute } from "@flexexa/domain/connect";
import type { CanonicalEntityId } from "@flexexa/domain";
import type { AssetScope, ConnectionRouteSnapshot } from "@flexexa/domain/connect";

export interface RoutingPolicy {
  readonly policy_set_version_id: CanonicalEntityId;
  readonly max_state_age_ms: number;
  readonly max_connectivity_age_ms: number;
  readonly max_capability_age_ms: number;
  readonly allow_degraded: boolean;
}
export function parseRoutingPolicy(value: unknown): RoutingPolicy {
  const input = record(value);
  exactKeys(input, ["policy_set_version_id", "max_state_age_ms", "max_connectivity_age_ms", "max_capability_age_ms", "allow_degraded"]);
  for (const field of ["max_state_age_ms", "max_connectivity_age_ms", "max_capability_age_ms"]) {
    if (!Number.isSafeInteger(input[field]) || Number(input[field]) <= 0) throw new DomainError("VALIDATION_ERROR");
  }
  if (typeof input.allow_degraded !== "boolean") throw new DomainError("VALIDATION_ERROR");
  return Object.freeze({ policy_set_version_id: entityId(input.policy_set_version_id),
    max_state_age_ms: input.max_state_age_ms as number,
    max_connectivity_age_ms: input.max_connectivity_age_ms as number,
    max_capability_age_ms: input.max_capability_age_ms as number,
    allow_degraded: input.allow_degraded,
  });
}
function fresh(at: string | null, now: number, maxAge: number): boolean {
  if (at === null) return false;
  const age = now - Date.parse(at);
  return age >= 0 && age < maxAge;
}
/**
 * Pure route planning ONLY: this neither authenticates nor sends a command.
 * Call inside the future authorized service transaction, then persist the selected
 * connection and policy version with the command/outbox before any external I/O.
 */
export function selectConnectionRoute(
  scope: AssetScope, capability: unknown, effectiveAt: unknown, candidates: readonly unknown[], policyInput: unknown,
) {
  const required = connectCapability(capability), at = utcInstant(effectiveAt);
  const policy = parseRoutingPolicy(policyInput), now = Date.parse(at);
  const readsState = ["read_soc", "read_power", "read_energy", "solar_read"].includes(required);
  if (!Array.isArray(candidates) || candidates.length > 1000) throw new DomainError("VALIDATION_ERROR");
  const parsed = candidates.map(candidate => parseConnectionRoute(candidate, scope));
  if (new Set(parsed.map(c => c.connection_id)).size !== parsed.length) throw new DomainError("VALIDATION_ERROR");
  const rejected: { readonly connection_id: CanonicalEntityId; readonly reason: string }[] = [];
  const eligible: ConnectionRouteSnapshot[] = [];
  for (const candidate of parsed) {
    let reason: string | null = null;
    if (candidate.connection_status !== "connected" || candidate.account_status !== "connected" || candidate.provider_status !== "active") reason = "CONNECTION_INACTIVE";
    else if (at < candidate.valid_from || (candidate.valid_until !== null && at >= candidate.valid_until)) reason = "CONNECTION_NOT_EFFECTIVE";
    else if (candidate.health !== "healthy" && !(candidate.health === "degraded" && policy.allow_degraded)) reason = "PROVIDER_UNHEALTHY";
    else if (!candidate.capabilities.includes(required)) reason = "CAPABILITY_UNSUPPORTED";
    else if (!fresh(candidate.capabilities_verified_at, now, policy.max_capability_age_ms)) reason = "STALE_CAPABILITIES";
    else if (!fresh(candidate.last_seen_at, now, policy.max_connectivity_age_ms)) reason = "STALE_CONNECTIVITY";
    else if (!readsState && !fresh(candidate.state_observed_at, now, policy.max_state_age_ms)) reason = "STALE_TELEMETRY";
    if (reason !== null) rejected.push(Object.freeze({ connection_id: candidate.connection_id, reason }));
    else eligible.push(candidate);
  }
  // Health first; lower numeric priority wins next; stable ID breaks ties.
  eligible.sort((a, b) => Number(a.health === "degraded") - Number(b.health === "degraded") ||
    a.priority - b.priority || (a.connection_id < b.connection_id ? -1 : a.connection_id > b.connection_id ? 1 : 0));
  rejected.sort((a, b) => a.connection_id < b.connection_id ? -1 : a.connection_id > b.connection_id ? 1 : 0);
  return Object.freeze({ decision: eligible.length ? "select" as const : "deny" as const,
    selected_route: eligible[0] ?? null, policy_set_version_id: policy.policy_set_version_id,
    effective_at: at, required_capability: required,
    reason_codes: Object.freeze(eligible.length ? [] : ["NO_ELIGIBLE_CONNECTION"]),
    rejected: Object.freeze(rejected),
  });
}
export type DeliveryOutcome = "definitely_not_sent" | "delivery_unknown" | "accepted" | "terminal_failure" | "measurement_confirmed";
/** A transport timeout is NOT evidence that a command was never sent. */
export function providerRetryDisposition(outcome: DeliveryOutcome) {
  switch (outcome) {
    case "definitely_not_sent": return "revalidate_before_new_route" as const;
    case "delivery_unknown":
    case "accepted":
    case "terminal_failure": return "reconcile_pinned_route" as const;
    case "measurement_confirmed": return "no_retry" as const;
    default: throw new DomainError("VALIDATION_ERROR");
  }
}
