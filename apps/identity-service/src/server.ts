import {createServer} from 'node:http';
import type {IncomingMessage} from 'node:http';
import {DomainError,entityId,record,tenantId} from '@flexexa/domain';
import {connectEnvironment} from '@flexexa/domain/connect';
import {createProvisioner} from './provision.ts';
import {createCallerRpc,createReservedAuthAdmin} from './supabase.ts';
import type {Connection} from './supabase.ts';
import {observeRequest} from './observability.ts';
import type {LogSink} from './observability.ts';
async function body(request:IncomingMessage){
 const chunks:Buffer[]=[];let size=0;
 for await(const chunk of request){size+=chunk.length;if(size>4096)throw new DomainError('VALIDATION_ERROR');chunks.push(chunk);}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new DomainError('VALIDATION_ERROR');}
}
export function createIdentityServer(config:Connection & {publishableKey:string;adminKey:string;environment:string;logSink?:LogSink}){
 const environment=connectEnvironment(config.environment);
 createReservedAuthAdmin(config,config.adminKey); // Validate configuration before accepting requests.
 let active=0;
 const server=createServer(async(req,res)=>{
  const observation=observeRequest(req,res,config.logSink);
  return observation.run(async()=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status:number,data:unknown)=>{res.statusCode=status;res.end(JSON.stringify(data));};
  if(req.method==='GET'&&req.url==='/health/live'){reply(200,{status:'alive'});return;}
  if(req.method!=='POST'||req.url!=='/v1/identity/provisioning/execute'){reply(404,{error:'NOT_FOUND'});return;}
  if(active>=8){reply(503,{error:'UNAVAILABLE'});return;}
  active++;
  try{
   if(req.headers['content-type']?.split(';')[0]?.trim()!=='application/json'||req.headers['content-encoding'])throw new DomainError('VALIDATION_ERROR');
   const match=/^Bearer ([A-Za-z0-9_.-]{10,16384})$/u.exec(req.headers.authorization??'');
   if(!match)throw new DomainError('PERMISSION_DENIED');
   const p=record(await body(req)),lease=record(p.lease);
   observation.setCorrelationId(entityId(p.correlation_id));
   const connection={...config,correlationId:observation.correlationId};
   // Tenant selection is untrusted until the caller-JWT RPC independently authorizes it.
   const scope={tenant_id:tenantId(lease.tenant_id),environment};
   const rpc=createCallerRpc(connection,config.publishableKey,match[1]!);
   const admin=createReservedAuthAdmin(connection,config.adminKey);
   reply(200,await createProvisioner(rpc,admin,scope).execute(p));
  }catch(error){
   const code=error instanceof DomainError?error.code:'INTERNAL_ERROR';
   const status=code==='PERMISSION_DENIED'||code==='TENANT_MISMATCH'?403:code==='VALIDATION_ERROR'?400:
    code==='INVALID_STATE_TRANSITION'||code==='IDEMPOTENCY_CONFLICT'?409:502;
   reply(status,{error:code});
  }finally{active--;}
  });
 });
 server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=30;
 return server;
}
