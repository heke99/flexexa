import {DomainError,assertSameTenant,entityId,exactKeys,record,tenantId,text,utcInstant} from '@flexexa/domain';
export function parseChargingCompanies(value:unknown){
 if(!Array.isArray(value)||value.length>100)throw new DomainError('VALIDATION_ERROR');const seen=new Set<string>();
 return value.map(raw=>{const p=record(raw);exactKeys(p,['id','name']);const id=tenantId(p.id);if(seen.has(id))throw new DomainError('VALIDATION_ERROR');seen.add(id);return {id,name:text(p.name)};});
}
export function parseChargingInventory(value:unknown,expected:string){
 const p=record(value);exactKeys(p,['tenant_id','generated_at','mode','assets','has_more']);const tenant=tenantId(expected);assertSameTenant(tenant,p.tenant_id);
 if(p.mode!=='live'||typeof p.has_more!=='boolean'||!Array.isArray(p.assets)||p.assets.length>100)throw new DomainError('VALIDATION_ERROR');
 const seen=new Set<string>();const assets=p.assets.map(raw=>{const a=record(raw);exactKeys(a,['asset_id','site_id','label','status','asset_type']);const id=entityId(a.asset_id);
  if(seen.has(id)||!['ev','evse'].includes(String(a.asset_type))||!['active','offline','disabled','archived'].includes(String(a.status)))throw new DomainError('VALIDATION_ERROR');seen.add(id);
  return {asset_id:id,site_id:entityId(a.site_id),label:text(a.label),status:a.status as string,asset_type:a.asset_type as string};});
 return {tenant_id:tenant,generated_at:utcInstant(p.generated_at),mode:'live' as const,has_more:p.has_more,assets};
}
export function parsePlatformInventory(value:unknown){
 const p=record(value);exactKeys(p,['generated_at','mode','companies','has_more']);
 if(p.mode!=='live'||typeof p.has_more!=='boolean'||!Array.isArray(p.companies)||p.companies.length>1000)throw new DomainError('VALIDATION_ERROR');
 const seen=new Set<string>();const companies=p.companies.map(raw=>{const c=record(raw);exactKeys(c,['tenant_id','label','asset_count']);const tenant=tenantId(c.tenant_id);
  if(seen.has(tenant)||typeof c.asset_count!=='number'||!Number.isSafeInteger(c.asset_count)||c.asset_count<0)throw new DomainError('VALIDATION_ERROR');seen.add(tenant);
  return {tenant_id:tenant,label:text(c.label),asset_count:c.asset_count};});
 return {generated_at:utcInstant(p.generated_at),mode:'live' as const,has_more:p.has_more,companies};
}
