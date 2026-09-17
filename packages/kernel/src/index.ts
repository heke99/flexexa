import { DomainError, entityId, assertSameTenant, utcInstant, record, exactKeys, tenantId } from "@flexexa/domain";
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
  const input = record(policy);
  exactKeys(input, ['tenant_id', 'policy_set_version_id', 'valid_from', 'valid_until', 'limits', 'deny_reasons']);
  assertSameTenant(tenantId(expectedTenant), input.tenant_id);
  const policyVersion = entityId(input.policy_set_version_id);
  const now = utcInstant(effectiveAt), start = utcInstant(input.valid_from), end = utcInstant(input.valid_until);
  if (!Array.isArray(input.limits) || input.limits.length > 1024 || !Array.isArray(input.deny_reasons) || input.deny_reasons.length > 128) throw new DomainError("VALIDATION_ERROR");
  const reasons: string[] = Array.from(input.deny_reasons, (value: unknown) => {
    if (typeof value !== 'string' || !/^[A-Z][A-Z0-9_]{0,63}$/u.test(value)) throw new DomainError("VALIDATION_ERROR");
    return value;
  });
  if (start >= end || now < start || now >= end) reasons.push("POLICY_NOT_EFFECTIVE");
  if (input.limits.length === 0) reasons.push("POLICY_LIMITS_MISSING");
  let minimum = 0, maximum = Number.POSITIVE_INFINITY;
  const versions: CanonicalEntityId[] = [];
  for (const value of input.limits) {
    const limit = record(value);
    exactKeys(limit, ['rule_version_id', 'minimum_kw', 'maximum_kw']);
    versions.push(entityId(limit.rule_version_id));
    if (typeof limit.minimum_kw !== 'number' || typeof limit.maximum_kw !== 'number' ||
      !Number.isFinite(limit.minimum_kw) || !Number.isFinite(limit.maximum_kw) || limit.minimum_kw < 0 || limit.maximum_kw < limit.minimum_kw) throw new DomainError("VALIDATION_ERROR");
    minimum = Math.max(minimum, limit.minimum_kw); maximum = Math.min(maximum, limit.maximum_kw);
  }
  if (minimum > maximum) reasons.push("POLICY_CONSTRAINT_CONFLICT");
  const allowed = reasons.length === 0;
  return Object.freeze({ decision: allowed ? "limit" as const : "deny" as const, allowed,
    policy_set_version_id: policyVersion,
    constraints_json: allowed ? Object.freeze({ minimum_kw: minimum, maximum_kw: maximum }) : null,
    reason_codes: Object.freeze([...new Set(reasons)].sort()),
    applied_rule_versions: Object.freeze([...new Set(versions)].sort()),
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
