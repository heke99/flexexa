import swedishV1 from './se/v1.json' with {type:'json'};
import {DomainError,exactKeys,ianaTimezone,record} from '../packages/domain/src/index.ts';
export const COUNTRY_DOMAINS=Object.freeze(['metadata','tax','price_sources','tariff_sources','tso','market_actor_identifiers','flex_products','meter_rules'] as const);
export type CountryDomain=typeof COUNTRY_DOMAINS[number];
export interface CountryPack {
 readonly schema_version:1;readonly pack_version:string;readonly country_code:string;readonly currency:string;
 readonly timezone:string;readonly locale:string;readonly price_areas:readonly string[];readonly ready_domains:readonly CountryDomain[];
}
export function parseCountryPack(value:unknown):CountryPack{
 const p=record(value);exactKeys(p,['schema_version','pack_version','country_code','currency','timezone','locale','price_areas','ready_domains']);
 if(p.schema_version!==1||typeof p.pack_version!=='string'||p.pack_version.length>32||!/^\d+\.\d+\.\d+$/u.test(p.pack_version)||
  typeof p.country_code!=='string'||!/^[A-Z]{2}$/u.test(p.country_code)||typeof p.currency!=='string'||!/^[A-Z]{3}$/u.test(p.currency)||
  typeof p.locale!=='string'||!/^[a-z]{2,3}-[A-Z]{2}$/u.test(p.locale)||!Array.isArray(p.price_areas)||p.price_areas.length<1||p.price_areas.length>64||
  Array.from(p.price_areas).some(a=>typeof a!=='string'||!/^[A-Z0-9_-]{1,32}$/u.test(a))||new Set(p.price_areas).size!==p.price_areas.length||
  !Array.isArray(p.ready_domains)||p.ready_domains.length<1||Array.from(p.ready_domains).some(d=>!COUNTRY_DOMAINS.includes(d as CountryDomain))||
  new Set(p.ready_domains).size!==p.ready_domains.length)throw new DomainError('VALIDATION_ERROR');
 return Object.freeze({schema_version:1,pack_version:p.pack_version,country_code:p.country_code,currency:p.currency,
  timezone:ianaTimezone(p.timezone),locale:p.locale,price_areas:Object.freeze([...p.price_areas] as string[]),ready_domains:Object.freeze([...p.ready_domains] as CountryDomain[])});
}
const seV1=parseCountryPack(swedishV1);
export function getCountryPack(countryCode:string):CountryPack|null{
 if(typeof countryCode!=='string'||!/^[A-Z]{2}$/u.test(countryCode))throw new DomainError('VALIDATION_ERROR');
 return countryCode===seV1.country_code?seV1:null;
}
export function requireCountryDomain(countryCode:string,domain:CountryDomain):CountryPack{
 const pack=getCountryPack(countryCode);
 if(!COUNTRY_DOMAINS.includes(domain))throw new DomainError('VALIDATION_ERROR');
 if(!pack||!pack.ready_domains.includes(domain))throw new DomainError('INVALID_STATE_TRANSITION');
 return pack;
}
/** Frozen V1 wire/default compatibility, not automatic geography inference for new APIs. */
export const legacyCoreV1Defaults=Object.freeze({country_code:seV1.country_code,timezone:seV1.timezone,currency:seV1.currency,locale:seV1.locale});
/** New callers must choose a country; unknown packs require an explicit IANA timezone. */
export function resolveCountryLocation(countryCode:string,timezone?:unknown){
 const pack=getCountryPack(countryCode);
 const selected=timezone===undefined?pack?.timezone:timezone;
 if(selected===undefined)throw new DomainError('VALIDATION_ERROR');
 return Object.freeze({country_code:countryCode,timezone:ianaTimezone(selected)});
}
