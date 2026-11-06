import {DomainError} from '@flexexa/domain';
import {normalizeSpotDay,priceRequest} from '@flexexa/api-contracts/spot-prices';
type Day=ReturnType<typeof normalizeSpotDay>;
export class PriceUnavailable extends Error {}
/** Bounded server cache. No stale-on-error and no unpublished-day replacement. */
export function createPriceReader(send:typeof fetch=fetch,now:()=>Date=()=>new Date()){
 const cache=new Map<string,{until:number;value:Day}>(),pending=new Map<string,Promise<Day>>();
 return async(area:string,date:string):Promise<Day>=>{
  priceRequest(area,date);const key=area+date,hit=cache.get(key),time=now().getTime();
  if(hit&&hit.until>time)return hit.value;
  if(pending.has(key))return pending.get(key)!;
  if(pending.size>=8)throw new PriceUnavailable('BUSY');
  const operation=(async()=>{
   const url=`https://www.elprisetjustnu.se/api/v1/prices/${date.slice(0,4)}/${date.slice(5)}_${area}.json`;
   const r=await send(url,{signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store'});
   if(!r.ok)throw new PriceUnavailable('UNPUBLISHED_OR_UNAVAILABLE');
   if(!r.headers.get('content-type')?.includes('application/json'))throw new PriceUnavailable('INVALID_UPSTREAM');
   const reader=r.body?.getReader();if(!reader)throw new PriceUnavailable('INVALID_UPSTREAM');
   const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const p=await reader.read();if(p.done)break;size+=p.value.byteLength;if(size>131072){await reader.cancel();throw new PriceUnavailable('INVALID_UPSTREAM');}chunks.push(p.value);}}finally{reader.releaseLock();}
   const value=normalizeSpotDay(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown,area,date,now());
   if(cache.size>=32)cache.delete(cache.keys().next().value!);cache.set(key,{until:now().getTime()+300000,value});return value;
  })();pending.set(key,operation);
  try{return await operation;}catch(error){if(error instanceof DomainError)throw new PriceUnavailable('INVALID_UPSTREAM');throw error;}finally{pending.delete(key);}
 };
}
export const readSpotPrices=createPriceReader();
