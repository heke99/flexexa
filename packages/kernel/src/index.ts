import { DomainError, entityId, assertSameTenant, utcInstant } from "@flexexa/domain";
import type { CanonicalEntityId, TenantId } from "@flexexa/domain";
export const FLEXEXA_KERNEL_VERSION = "0.1.0";
export type PolicyDecision = "allow" | "deny" | "limit" | "select" | "calculated";
export interface PowerLimit { readonly rule_version_id: CanonicalEntityId; readonly minimum_kw: number; readonly maximum_kw: number }
export interface CompiledPowerPolicy {
  readonly tenant_id: TenantId;
  readonly policy_set_version_id: CanonicalEntityId;
  readonly valid_from: string;
  readonly valid_until: string;
  readonly limits: readonly PowerLimit[];
  readonly deny_reasons: readonly string[];
}
/** Pure composition, NOT authentication, signature verification, publication or device safety. */
export function intersectPowerPolicy(policy: CompiledPowerPolicy, expectedTenant: TenantId, effectiveAt: string) {
  assertSameTenant(expectedTenant, policy.tenant_id);
  entityId(policy.policy_set_version_id);
  const now = utcInstant(effectiveAt), start = utcInstant(policy.valid_from), end = utcInstant(policy.valid_until);
  const reasons = [...policy.deny_reasons];
  if (start >= end || now < start || now >= end) reasons.push("POLICY_NOT_EFFECTIVE");
  if (policy.limits.length === 0) reasons.push("POLICY_LIMITS_MISSING");
  let minimum = 0, maximum = Number.POSITIVE_INFINITY;
  for (const limit of policy.limits) {
    entityId(limit.rule_version_id);
    if (!Number.isFinite(limit.minimum_kw) || !Number.isFinite(limit.maximum_kw) || limit.minimum_kw < 0 || limit.maximum_kw < limit.minimum_kw) throw new DomainError("VALIDATION_ERROR");
    minimum = Math.max(minimum, limit.minimum_kw); maximum = Math.min(maximum, limit.maximum_kw);
  }
  if (minimum > maximum) reasons.push("POLICY_CONSTRAINT_CONFLICT");
  const allowed = reasons.length === 0;
  return Object.freeze({ decision: allowed ? "limit" as const : "deny" as const, allowed,
    policy_set_version_id: policy.policy_set_version_id,
    constraints_json: allowed ? { minimum_kw: minimum, maximum_kw: maximum } : null,
    reason_codes: [...new Set(reasons)].sort(),
    applied_rule_versions: [...new Set(policy.limits.map(l=>l.rule_version_id))].sort(),
  });
}
export const COMMAND_TRANSITIONS = Object.freeze({
  requested: ["validated", "failed", "cancelled", "expired"], validated: ["queued", "failed", "cancelled", "expired"],
  queued: ["sent", "failed", "cancelled", "expired"], sent: ["acknowledged", "failed", "expired"],
  acknowledged: ["executing", "failed", "expired"], executing: ["measurement_confirmed", "failed", "expired"],
  measurement_confirmed: ["completed", "failed"], completed: [], failed: [], expired: [], cancelled: [],
} as const);
for (const targets of Object.values(COMMAND_TRANSITIONS)) Object.freeze(targets);
export type CommandState = keyof typeof COMMAND_TRANSITIONS;
export function assertCommandTransition(from: CommandState, to: CommandState): void {
  if (!Object.hasOwn(COMMAND_TRANSITIONS, from) || !(COMMAND_TRANSITIONS[from] as readonly string[]).includes(to)) throw new DomainError("INVALID_STATE_TRANSITION");
}
