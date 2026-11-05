import {tenantId} from '@flexexa/domain';
import {parseChargingInventory,parsePlatformInventory} from '@flexexa/api-contracts/charging-inventory';
const origin='https://api-staging.flexexa.com';
const maximumBytes=262144;
function response(status:number,value:unknown){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
async function boundedJson(upstream:Response){
 if(!upstream.headers.get('content-type')?.toLowerCase().startsWith('application/json')||!upstream.body)throw Error('INVALID_UPSTREAM');
 const reader=upstream.body.getReader(),chunks:Uint8Array[]=[];let bytes=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maximumBytes)throw Error('BODY_LIMIT');chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
 const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer));
}
/** Same-origin browser boundary: caller JWT only; fixed upstream, no service key or permission cache. */
export function createChargingProxy(fetcher:typeof fetch=fetch){
 return async(request:Request,scope:'company'|'platform')=>{
  if(request.method!=='GET')return response(405,{error:'METHOD_NOT_ALLOWED'});
  const authorization=request.headers.get('authorization')??'';
  if(!/^Bearer [A-Za-z0-9_.-]{10,16384}$/u.test(authorization))return response(401,{error:'UNAUTHENTICATED'});
  let tenant:string|undefined;
  try{const params=new URL(request.url).searchParams;if(scope==='company'){if([...params.keys()].some(k=>k!=='tenant_id')||params.getAll('tenant_id').length!==1)throw Error();tenant=tenantId(params.get('tenant_id'));}else if([...params].length)throw Error();}
  catch{return response(400,{error:'INVALID_REQUEST'});}
  try{
   const upstream=await fetcher(origin+(scope==='company'?'/v1/companies/'+tenant+'/charging-inventory':'/v1/platform/charging-inventory'),{method:'GET',headers:{Authorization:authorization,Accept:'application/json'},cache:'no-store',redirect:'error',signal:AbortSignal.any([request.signal,AbortSignal.timeout(6000)])});
   if(upstream.status===401||upstream.status===403){await upstream.body?.cancel();return response(upstream.status,{error:upstream.status===401?'UNAUTHENTICATED':'PERMISSION_DENIED'});}
   if(upstream.status!==200){await upstream.body?.cancel();return response(502,{error:'UPSTREAM_UNAVAILABLE'});}
   const body=await boundedJson(upstream);
   return response(200,scope==='company'?parseChargingInventory(body,tenant!):parsePlatformInventory(body));
  }catch{return response(502,{error:'UPSTREAM_UNAVAILABLE'});}
 };
}
