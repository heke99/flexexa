import { DomainError, assertSameTenant, entityId, exactKeys, record, tenantId, text, utcInstant } from '@flexexa/domain';

/** Read model only: simulations never authorize a dispatch or promise departure success. */
export function parseChargingOverview(value: unknown, expectedTenant: string) {
 const p=record(value);exactKeys(p,['tenant_id','generated_at','mode','assets']);
 const tenant=tenantId(expectedTenant);assertSameTenant(tenant,p.tenant_id);
 if(p.mode!=='simulation'||!Array.isArray(p.assets)||p.assets.length>100)throw new DomainError('VALIDATION_ERROR');
 const seen=new Set<string>();
 const assets=p.assets.map(raw=>{
  const a=record(raw);exactKeys(a,['asset_id','site_id','label','plan_status','departure_at','energy_kwh','electricity','variable_total','total','currency']);
  const id=entityId(a.asset_id);if(seen.has(id))throw new DomainError('VALIDATION_ERROR');seen.add(id);
  if(!['optimal','infeasible','blocked','unknown'].includes(String(a.plan_status))||a.currency!=='SEK'||a.total!==null)throw new DomainError('VALIDATION_ERROR');
  const decimal=(x:unknown)=>{if(typeof x!=='string'||! /^-?\d{1,9}(?:\.\d{1,8})?$/u.test(x))throw new DomainError('VALIDATION_ERROR');return x;};
  const energy=decimal(a.energy_kwh);if(energy.startsWith('-'))throw new DomainError('VALIDATION_ERROR');
  return Object.freeze({asset_id:id,site_id:entityId(a.site_id),label:text(a.label,100),plan_status:a.plan_status as 'optimal'|'infeasible'|'blocked'|'unknown',departure_at:utcInstant(a.departure_at),energy_kwh:energy,electricity:decimal(a.electricity),variable_total:decimal(a.variable_total),total:null,currency:'SEK' as const});
 });
 return Object.freeze({tenant_id:tenant,generated_at:utcInstant(p.generated_at),mode:'simulation' as const,assets:Object.freeze(assets)});
}
export type ChargingOverview=ReturnType<typeof parseChargingOverview>;

export function parsePlatformChargingOverview(value:unknown){
 const p=record(value);exactKeys(p,['generated_at','mode','companies']);
 if(p.mode!=='simulation'||!Array.isArray(p.companies)||p.companies.length>1000)throw new DomainError('VALIDATION_ERROR');
 const seen=new Set<string>();
 const companies=p.companies.map(raw=>{
  const c=record(raw);exactKeys(c,['tenant_id','label','asset_count','planned_count','blocked_count']);
  const id=tenantId(c.tenant_id);if(seen.has(id))throw new DomainError('VALIDATION_ERROR');seen.add(id);
  const count=(v:unknown)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>1000000)throw new DomainError('VALIDATION_ERROR');return v;};
  const assets=count(c.asset_count),planned=count(c.planned_count),blocked=count(c.blocked_count);
  if(planned+blocked>assets)throw new DomainError('VALIDATION_ERROR');
  return Object.freeze({tenant_id:id,label:text(c.label,100),asset_count:assets,planned_count:planned,blocked_count:blocked});
 });
 return Object.freeze({generated_at:utcInstant(p.generated_at),mode:'simulation' as const,companies:Object.freeze(companies)});
}
