import {createServer} from 'node:http';
import {DomainError,tenantId} from '@flexexa/domain';
import {parseChargingOverview,parsePlatformChargingOverview} from '@flexexa/api-contracts/charging-overview';
import {parseChargingInventory,parsePlatformInventory} from '@flexexa/api-contracts/charging-inventory';

/** Production adapter MUST recheck live membership/RBAC and RLS with the caller JWT.
 * No service-role fallback, token registry or production adapter is supplied here.
 * Platform reads require privileged audit persistence before returning data.
 */
export interface ChargingReadBackend {
 company(token:string,tenant:string,signal:AbortSignal):Promise<unknown>;
 platformAudited(token:string,signal:AbortSignal):Promise<unknown>;
 companyInventory?(token:string,tenant:string,signal:AbortSignal):Promise<unknown>;
 platformInventoryAudited?(token:string,signal:AbortSignal):Promise<unknown>;
}
export function createChargingReadServer(backend:ChargingReadBackend){
 let active=0;
 const server=createServer({requestTimeout:10000,headersTimeout:10000,connectionsCheckingInterval:1000,keepAliveTimeout:5000},async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status:number,value:unknown)=>{res.statusCode=status;res.end(JSON.stringify(value));};
  if(req.method!=='GET'){reply(405,{error:'METHOD_NOT_ALLOWED'});return;}
  const path=req.url??'';
  if(path==='/health/live'){reply(200,{status:'alive'});return;}
  const match=/^\/v1\/companies\/([0-9a-f-]{36})\/(charging-overview|charging-inventory)$/u.exec(path);
  const inventory=path.endsWith('/charging-inventory');
  if(!match&&path!=='/v1/platform/charging-overview'&&path!=='/v1/platform/charging-inventory'){reply(404,{error:'NOT_FOUND'});return;}
  const bearer=/^Bearer ([A-Za-z0-9_.-]{10,16384})$/u.exec(req.headers.authorization??'');
  if(!bearer){reply(401,{error:'UNAUTHENTICATED'});return;}
  if(active>=8){reply(503,{error:'UNAVAILABLE'});return;}active++;
  try{
   const signal=AbortSignal.timeout(5000);
   const operation=Promise.resolve().then(()=>{
    if(inventory){if(match&&backend.companyInventory)return backend.companyInventory(bearer[1]!,tenantId(match[1]),signal);if(!match&&backend.platformInventoryAudited)return backend.platformInventoryAudited(bearer[1]!,signal);throw new DomainError('CAPABILITY_UNSUPPORTED');}
    return match?backend.company(bearer[1]!,tenantId(match[1]),signal):backend.platformAudited(bearer[1]!,signal);
   });
   // Bound response wait even if a faulty adapter ignores cancellation. Its slot
   // stays occupied until it actually settles, preventing unbounded orphan calls.
   void operation.finally(()=>{active--;}).catch(()=>{});
   let stop:()=>void=()=>{};
   const timeout=new Promise<never>((_,reject)=>{stop=()=>reject(new Error('TIMEOUT'));signal.addEventListener('abort',stop,{once:true});});
   let raw:unknown;
   try{raw=await Promise.race([operation,timeout]);}finally{signal.removeEventListener('abort',stop);}
   reply(200,inventory?(match?parseChargingInventory(raw,match[1]!):parsePlatformInventory(raw)):(match?parseChargingOverview(raw,match[1]!):parsePlatformChargingOverview(raw)));
  }catch(error){
   const denied=error instanceof DomainError&&(error.code==='PERMISSION_DENIED'||error.code==='TENANT_MISMATCH');
   reply(denied?403:502,{error:denied?'PERMISSION_DENIED':'UPSTREAM_FAILURE'});
  }
 });
 server.maxHeadersCount=30;return server;
}
