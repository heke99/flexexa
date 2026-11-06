import {randomUUID} from 'node:crypto';
import {DomainError,record,tenantId} from '@flexexa/domain';
/** Only a publishable key and the per-request caller JWT. Never a service-role key. */
export function createChargingDatabase(config:{url:string;publishableKey:string;fetcher?:typeof fetch;allowLoopback?:boolean}){
 const url=new URL(config.url);if(url.pathname!=='/'||url.search||url.hash||url.username||url.password||!(url.protocol==='https:'||config.allowLoopback&&url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw new DomainError('VALIDATION_ERROR');
 if(!/^sb_publishable_[A-Za-z0-9_-]+$/u.test(config.publishableKey))throw new DomainError('VALIDATION_ERROR');
 const send=config.fetcher??fetch;
 async function rpc(name:string,args:unknown,token:string,signal:AbortSignal){
  if(!/^[A-Za-z0-9_.-]{10,16384}$/u.test(token))throw new DomainError('PERMISSION_DENIED');
  const response=await send(url.origin+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',signal,headers:{apikey:config.publishableKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(args)});
  if(response.status===401||response.status===403)throw new DomainError('PERMISSION_DENIED');
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))throw new DomainError('INTERNAL_ERROR');
  const reader=response.body?.getReader();if(!reader)throw new DomainError('INTERNAL_ERROR');let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>1048576){await reader.cancel();throw new DomainError('INTERNAL_ERROR');}chunks.push(r.value);}}finally{reader.releaseLock();}
  return record(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown);
 }
 return {
  companyInventory:(token:string,tenant:string,signal:AbortSignal)=>rpc('flexexa_charging_inventory',{p_tenant_id:tenantId(tenant)},token,signal),
  platformInventoryAudited:(token:string,signal:AbortSignal)=>rpc('flexexa_platform_charging_inventory',{p_correlation_id:randomUUID()},token,signal),
  company:async()=>{throw new DomainError('CAPABILITY_UNSUPPORTED');},
  platformAudited:async()=>{throw new DomainError('CAPABILITY_UNSUPPORTED');}
 };
}
