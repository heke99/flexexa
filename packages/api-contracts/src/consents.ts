import {DomainError, assertSameTenant, entityId, exactKeys, record, tenantId, utcInstant} from '@flexexa/domain';
import type {TenantId, CanonicalEntityId, UtcInstant} from '@flexexa/domain';
import {parseGrantConsentPayload, parseRevokeConsentPayload, parseConsentCheckPayload} from '@flexexa/domain/consents';
import type {GrantConsentPayload, RevokeConsentPayload, ConsentCheckPayload, ConsentType} from '@flexexa/domain/consents';
import type {ConnectEnvironment} from '@flexexa/domain/connect';
import {parseMutation} from './index.ts';
import type {MutationRequest} from './index.ts';
import {databaseError} from './rpc.ts';
export {parseGrantConsentPayload, parseRevokeConsentPayload, parseConsentCheckPayload};
export const parseGrantConsentRequest = (v: unknown, t: TenantId) => parseMutation(v, t, parseGrantConsentPayload);
export const parseRevokeConsentRequest = (v: unknown, t: TenantId) => parseMutation(v, t, parseRevokeConsentPayload);
export interface ConsentReceipt {
  readonly tenant_id: TenantId;
  readonly resource_type: 'consent';
  readonly resource_id: CanonicalEntityId;
  readonly correlation_id: CanonicalEntityId;
  readonly idempotency_key: string;
  readonly environment: ConnectEnvironment;
  readonly status: 'granted' | 'revoked';
}
export function parseConsentReceipt(value: unknown, request: MutationRequest<GrantConsentPayload | RevokeConsentPayload>): ConsentReceipt {
  const p = record(value);
  exactKeys(p, ['tenant_id', 'resource_type', 'resource_id', 'correlation_id', 'idempotency_key', 'environment', 'status']);
  assertSameTenant(request.tenant_id, p.tenant_id);
  const resource = entityId(p.resource_id), revoked = 'consent_id' in request.payload;
  if (p.resource_type !== 'consent' || p.environment !== request.payload.environment || p.idempotency_key !== request.idempotency_key ||
      p.status !== (revoked ? 'revoked' : 'granted') || revoked && resource !== request.payload.consent_id) throw new DomainError('VALIDATION_ERROR');
  return Object.freeze({tenant_id: request.tenant_id, resource_type: 'consent', resource_id: resource, correlation_id: entityId(p.correlation_id),
    idempotency_key: request.idempotency_key, environment: request.payload.environment, status: revoked ? 'revoked' : 'granted'});
}
export interface ConsentDecision {
  readonly tenant_id: TenantId;
  readonly consent_id: CanonicalEntityId;
  readonly environment: ConnectEnvironment;
  readonly consent_type: ConsentType;
  readonly policy_version: string;
  readonly valid: boolean;
  readonly reason_code: 'valid' | 'CONSENT_REQUIRED';
  readonly checked_at: UtcInstant;
}
export interface ConsentRpcClient {
  rpc(name: 'flexexa_grant_consent' | 'flexexa_revoke_consent' | 'flexexa_check_consent',
    args: Readonly<{p_tenant_id: TenantId; p_payload: Readonly<Record<string, unknown>>; p_idempotency_key?: string; p_correlation_id?: string}>): PromiseLike<{data: unknown; error: unknown | null}>;
}
/** Session-bound transport. Decisions are point-in-time prerequisites, never cached
 * dispatch authority. A command must recheck inside its transaction and before send. */
export function createFlexexaConsentApi(client: ConsentRpcClient, expectedTenant: TenantId) {
  const tenant = tenantId(expectedTenant);
  async function call(name: Parameters<ConsentRpcClient['rpc']>[0], payload: unknown, request?: MutationRequest<unknown>): Promise<unknown> {
    const args = Object.freeze({p_tenant_id: tenant, p_payload: record(payload), ...(request ? {p_idempotency_key: request.idempotency_key, p_correlation_id: request.correlation_id} : {})});
    let result;
    try { result = await client.rpc(name, args); } catch { throw new DomainError('INTERNAL_ERROR'); }
    const response = record(result);
    if (response.error !== null && response.error !== undefined) throw databaseError(response.error);
    return response.data;
  }
  return Object.freeze({
    async grantConsent(value: unknown) {
      const request = parseGrantConsentRequest(value, tenant);
      return parseConsentReceipt(await call('flexexa_grant_consent', request.payload, request), request);
    },
    async revokeConsent(value: unknown) {
      const request = parseRevokeConsentRequest(value, tenant);
      return parseConsentReceipt(await call('flexexa_revoke_consent', request.payload, request), request);
    },
    async checkConsent(value: unknown): Promise<ConsentDecision> {
      const request: ConsentCheckPayload = parseConsentCheckPayload(value);
      const p = record(await call('flexexa_check_consent', request));
      exactKeys(p, ['tenant_id', 'consent_id', 'environment', 'consent_type', 'policy_version', 'valid', 'reason_code', 'checked_at']);
      assertSameTenant(tenant, p.tenant_id);
      if (entityId(p.consent_id) !== request.consent_id || p.environment !== request.environment || p.consent_type !== request.consent_type ||
          p.policy_version !== request.policy_version || typeof p.valid !== 'boolean' || p.reason_code !== (p.valid ? 'valid' : 'CONSENT_REQUIRED')) throw new DomainError('VALIDATION_ERROR');
      return Object.freeze({tenant_id: tenant, consent_id: request.consent_id, environment: request.environment, consent_type: request.consent_type,
        policy_version: request.policy_version, valid: p.valid, reason_code: p.valid ? 'valid' : 'CONSENT_REQUIRED', checked_at: utcInstant(p.checked_at)});
    },
  });
}
