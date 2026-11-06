import {DomainError,record} from '@flexexa/domain';
export const PRICE_AREAS=['SE1','SE2','SE3','SE4'] as const;
export function priceRequest(area:unknown,date:unknown){
 if(typeof area!=='string'||!(PRICE_AREAS as readonly string[]).includes(area)||typeof date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/u.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)throw new DomainError('VALIDATION_ERROR');
 return {area:area as typeof PRICE_AREAS[number],date};
}
export function stockholmDay(date:Date){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
/** Provider boundary. Preserve actual UTC interval lengths including DST transitions.
 * API prices are spot SEK/kWh excluding VAT, tax, retailer and network fees.
 */
export function normalizeSpotDay(raw:unknown,area:string,date:string,fetchedAt:Date){
 const request=priceRequest(area,date);
 if(!Array.isArray(raw)||raw.length<23||raw.length>100)throw new DomainError('VALIDATION_ERROR');
 let previous=0,total=0;
 const intervals=raw.map(value=>{
  const p=record(value),rate=p.SEK_per_kWh;
  const instant=(v:unknown)=>{if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/u.test(v))throw new DomainError('VALIDATION_ERROR');const n=Date.parse(v);if(!Number.isFinite(n))throw new DomainError('VALIDATION_ERROR');return n;};
  const start=instant(p.time_start),end=instant(p.time_end),duration=(end-start)/60000;
  if(typeof rate!=='number'||!Number.isFinite(rate)||Math.abs(rate)>1000000||![15,60].includes(duration)||previous&&start!==previous||stockholmDay(new Date(start))!==date)throw new DomainError('VALIDATION_ERROR');
  previous=end;total+=duration;
  return {starts_at:new Date(start).toISOString(),ends_at:new Date(end).toISOString(),spot_sek_per_kwh_ex_vat:rate.toFixed(8)};
 });
 const clock=(n:number)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(n));
 if(![1380,1440,1500].includes(total)||clock(Date.parse(intervals[0]!.starts_at))!=='00:00'||clock(previous)!=='00:00'||stockholmDay(new Date(previous-1))!==date||stockholmDay(new Date(previous))===date)throw new DomainError('VALIDATION_ERROR');
 return {schema_version:1 as const,...request,source:'elprisetjustnu.se' as const,source_url:`https://www.elprisetjustnu.se/api/v1/prices/${date.slice(0,4)}/${date.slice(5)}_${area}.json`,fetched_at:fetchedAt.toISOString(),currency:'SEK' as const,unit:'kWh' as const,vat_included:false as const,retailer_fees_included:false as const,grid_fees_included:false as const,tax_included:false as const,intervals};
}
