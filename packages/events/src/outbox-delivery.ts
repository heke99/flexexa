import { DomainError, entityId, tenantId, utcInstant, record, exactKeys } from '@flexexa/domain';
import { parseTenantEvent } from './index.ts';

export interface OutboxScope { readonly tenant_id: string; readonly environment: 'sandbox' | 'production' }
export interface OutboxDatabase {
  claim(scope: OutboxScope): Promise<unknown>;
  finish(scope: OutboxScope, leaseId: string, outcome: 'published' | 'retry'): Promise<unknown>;
}
export interface ConfirmedPublisher {
  /** Resolve only after a durable, mandatory/routable broker publish is confirmed.
   * A socket write or an HTTP acceptance is not a publish confirmation. */
  publishConfirmed(message: Readonly<{ body: string; message_id: string; correlation_id: string; event_type: string }>): Promise<void>;
}

/** One bounded delivery. Credentials, polling, broker topology and shutdown belong
 * to the hosting service. No business effect is executed here. At-least-once only. */
export async function deliverOutboxEvent(
  expected: OutboxScope, database: OutboxDatabase, publisher: ConfirmedPublisher,
  clock: () => number = Date.now,
): Promise<'idle' | 'published' | 'pending' | 'dead_letter'> {
  const scopeInput = record(expected);
  exactKeys(scopeInput, ['tenant_id', 'environment']);
  if (scopeInput.environment !== 'sandbox' && scopeInput.environment !== 'production') throw new DomainError('VALIDATION_ERROR');
  const scope: OutboxScope = Object.freeze({ tenant_id: tenantId(scopeInput.tenant_id), environment: scopeInput.environment });
  const raw = await database.claim(scope);
  if (raw === null) return 'idle';
  const claim = record(raw);
  exactKeys(claim, ['lease_id', 'generation', 'expires_at', 'environment', 'event']);
  const leaseId = entityId(claim.lease_id), expires = Date.parse(utcInstant(claim.expires_at));
  if (claim.environment !== scope.environment || !Number.isInteger(claim.generation) || Number(claim.generation) < 1 || Number(claim.generation) > 10) throw new DomainError('VALIDATION_ERROR');
  const event = parseTenantEvent(claim.event, tenantId(scope.tenant_id));
  if (record(event.payload).environment !== scope.environment) throw new DomainError('PERMISSION_DENIED');
  const now = clock();
  if (!Number.isFinite(now) || now >= expires || expires > now + 30_000) throw new DomainError('INVALID_STATE_TRANSITION');
  // Detach the serialized message before handing control to external I/O.
  const message = Object.freeze({ body: JSON.stringify(event), message_id: event.event_id,
    correlation_id: event.correlation_id, event_type: event.event_type });
  let outcome: 'published' | 'retry' = 'published';
  try { await publisher.publishConfirmed(message); }
  catch { outcome = 'retry'; }
  // If finish fails after a confirmation, leave the ambiguous attempt to expire.
  // Never issue a contradictory retry or a second publish in this call.
  const result = record(await database.finish(scope, leaseId, outcome));
  exactKeys(result, ['lease_id', 'status']);
  if (entityId(result.lease_id) !== leaseId ||
    (outcome === 'published' ? result.status !== 'published' : result.status !== 'pending' && result.status !== 'dead_letter')) throw new DomainError('VALIDATION_ERROR');
  return result.status as 'published' | 'pending' | 'dead_letter';
}
