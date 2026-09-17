import { DomainError, entityId, tenantId, record, exactKeys } from '@flexexa/domain';
import { parseTenantEvent } from './index.ts';
import type { CanonicalEventEnvelope } from './index.ts';
import type { OutboxScope } from './outbox-delivery.ts';

export interface PolicyInboxDatabase {
  /** Commit the inbox receipt, audit and readiness change in ONE transaction. */
  consume(scope: OutboxScope, event: CanonicalEventEnvelope): Promise<unknown>;
}
export interface InboxAcknowledgement {
  /** Acknowledge this exact broker delivery only after the database commits. */
  acknowledge(): Promise<void>;
}

/** One policy publication delivery. Failed/ambiguous calls leave the message
 * unacknowledged; hosting owns bounded redelivery/DLQ and connection shutdown. */
export async function consumePolicyPublication(
  expected: OutboxScope, input: unknown, database: PolicyInboxDatabase, delivery: InboxAcknowledgement,
): Promise<'processed' | 'superseded'> {
  const s = record(expected);
  exactKeys(s, ['tenant_id', 'environment']);
  if (s.environment !== 'sandbox') throw new DomainError('PERMISSION_DENIED');
  const scope: OutboxScope = Object.freeze({ tenant_id: tenantId(s.tenant_id), environment: s.environment });
  const event = parseTenantEvent(input, tenantId(scope.tenant_id));
  if (!['policy.version.published', 'flexexa.policy.published'].includes(event.event_type) || event.event_version !== 1 || event.source !== 'flexexa.policy') throw new DomainError('VALIDATION_ERROR');
  const payload = record(event.payload);
  exactKeys(payload, ['environment', 'policy_set_version_id', 'rules_checksum']);
  if (payload.environment !== scope.environment) throw new DomainError('PERMISSION_DENIED');
  entityId(payload.policy_set_version_id);
  if (typeof payload.rules_checksum !== 'string' || !/^[0-9a-f]{64}$/u.test(payload.rules_checksum)) throw new DomainError('VALIDATION_ERROR');
  const result = record(await database.consume(scope, event));
  exactKeys(result, ['event_id', 'tenant_id', 'environment', 'consumer_key', 'status']);
  if (entityId(result.event_id) !== event.event_id || tenantId(result.tenant_id) !== scope.tenant_id ||
    result.environment !== scope.environment || result.consumer_key !== 'policy_readiness.v1' ||
    (result.status !== 'processed' && result.status !== 'superseded')) throw new DomainError('VALIDATION_ERROR');
  await delivery.acknowledge();
  return result.status;
}
