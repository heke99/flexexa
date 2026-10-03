import {DomainError, entityId, exactKeys, record, utcInstant} from './index.ts';
import type {CanonicalEntityId, UtcInstant} from './index.ts';
import {connectEnvironment} from './connect.ts';
import type {ConnectEnvironment} from './connect.ts';

export const CONSENT_TYPES = Object.freeze(['smart_charging', 'remote_control', 'flex_participation', 'data_sharing', 'vehicle_api', 'location', 'market_participation'] as const);
export type ConsentType = typeof CONSENT_TYPES[number];
export interface ConsentScope {
  readonly customer_id: CanonicalEntityId;
  readonly site_id: CanonicalEntityId | null;
  readonly asset_id: CanonicalEntityId | null;
  readonly environment: ConnectEnvironment;
  readonly consent_type: ConsentType;
  readonly policy_version: string;
}
export interface GrantConsentPayload extends ConsentScope {
  readonly valid_until: UtcInstant;
  readonly source: 'customer_portal' | 'signed_document' | 'support_verified';
  readonly evidence_reference: string;
  readonly evidence_sha256: string;
}
export interface RevokeConsentPayload {
  readonly consent_id: CanonicalEntityId;
  readonly environment: ConnectEnvironment;
  readonly reason_code: 'customer_request' | 'security' | 'administrative';
}
export interface ConsentCheckPayload extends ConsentScope { readonly consent_id: CanonicalEntityId }
const scopeKeys = ['customer_id', 'site_id', 'asset_id', 'environment', 'consent_type', 'policy_version'];
function token(value: unknown): string {
  if (typeof value !== 'string' || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u.test(value)) throw new DomainError('VALIDATION_ERROR');
  return value;
}
function scope(p: Record<string, unknown>): ConsentScope {
  const site = p.site_id === null ? null : entityId(p.site_id), asset = p.asset_id === null ? null : entityId(p.asset_id);
  if (asset !== null && site === null || typeof p.consent_type !== 'string' || !(CONSENT_TYPES as readonly string[]).includes(p.consent_type)) throw new DomainError('VALIDATION_ERROR');
  return {customer_id: entityId(p.customer_id), site_id: site, asset_id: asset, environment: connectEnvironment(p.environment), consent_type: p.consent_type as ConsentType, policy_version: token(p.policy_version)};
}
/** Records attested evidence; the parser cannot authenticate a customer's signature.
 * A consent is one exact scope. No implicit parent inheritance or device authority. */
export function parseGrantConsentPayload(value: unknown): GrantConsentPayload {
  const p = record(value);
  exactKeys(p, [...scopeKeys, 'valid_until', 'source', 'evidence_reference', 'evidence_sha256']);
  if (p.source !== 'customer_portal' && p.source !== 'signed_document' && p.source !== 'support_verified' ||
      typeof p.evidence_sha256 !== 'string' || p.evidence_sha256.length !== 64 || !/^[a-f0-9]{64}$/u.test(p.evidence_sha256)) throw new DomainError('VALIDATION_ERROR');
  const expiry = utcInstant(p.valid_until);
  if (expiry !== p.valid_until) throw new DomainError('VALIDATION_ERROR');
  return Object.freeze({...scope(p), valid_until: expiry, source: p.source, evidence_reference: token(p.evidence_reference), evidence_sha256: p.evidence_sha256});
}
export function parseRevokeConsentPayload(value: unknown): RevokeConsentPayload {
  const p = record(value);
  exactKeys(p, ['consent_id', 'environment', 'reason_code']);
  if (p.reason_code !== 'customer_request' && p.reason_code !== 'security' && p.reason_code !== 'administrative') throw new DomainError('VALIDATION_ERROR');
  return Object.freeze({consent_id: entityId(p.consent_id), environment: connectEnvironment(p.environment), reason_code: p.reason_code});
}
export function parseConsentCheckPayload(value: unknown): ConsentCheckPayload {
  const p = record(value);
  exactKeys(p, [...scopeKeys, 'consent_id']);
  return Object.freeze({...scope(p), consent_id: entityId(p.consent_id)});
}
