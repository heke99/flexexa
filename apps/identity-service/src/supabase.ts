import {randomBytes} from 'node:crypto';
import {DomainError,entityId,exactKeys,record,tenantId} from '@flexexa/domain';
import {connectEnvironment} from '@flexexa/domain/connect';
import type {ReservedAuthAdmin,ReservedIdentity} from './provision.ts';
type Fetch=typeof fetch;
export interface Connection {url:string;allowLoopback?:boolean;fetcher?:Fetch}
function endpoint(config:Connection){
 const url=new URL(config.url);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
  !(url.protocol==='https:'||(config.allowLoopback===true&&url.protocol==='http:'&&url.hostname==='127.0.0.1')))
  throw new DomainError('VALIDATION_ERROR');
 return url.origin;
}
function credential(value:string){if(typeof value!=='string'||value.length<10||value.length>16384||/[\s\r\n]/u.test(value))throw new DomainError('VALIDATION_ERROR');return value;}
async function jsonResponse(response:Response){
 if(!response.headers.get('content-type')?.toLowerCase().includes('application/json'))throw new DomainError('INTERNAL_ERROR');
 const reader=response.body?.getReader();if(!reader)throw new DomainError('INTERNAL_ERROR');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;
  if(size>65536){await reader.cancel();throw new DomainError('INTERNAL_ERROR');}chunks.push(next.value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;}catch{throw new DomainError('INTERNAL_ERROR');}
}
function transport(config:Connection,headers:Readonly<Record<string,string>>){
 const origin=endpoint(config),send=config.fetcher??fetch;
 return async(path:string,method:string,body?:unknown)=>{
  try{
   const response=await send(origin+path,{method,headers:{...headers,'Content-Type':'application/json'},redirect:'error',
    signal:AbortSignal.timeout(5000),...(body===undefined?{}:{body:JSON.stringify(body)})});
   return {status:response.status,ok:response.ok,body:await jsonResponse(response)};
  }catch{throw new DomainError('INTERNAL_ERROR');}
 };
}
/** Per-request caller JWT. This client never holds an Auth-admin credential. */
export function createCallerRpc(config:Connection,publishableKey:string,callerJwt:string){
 const request=transport(config,{apikey:credential(publishableKey),Authorization:'Bearer '+credential(callerJwt)});
 const allowed=new Set(['flexexa_check_identity_execution_lease','flexexa_finalize_identity_provisioning']);
 return Object.freeze({async rpc(name:string,args:unknown){
  if(!allowed.has(name))throw new DomainError('PERMISSION_DENIED');
  const r=await request('/rest/v1/rpc/'+name,'POST',args);
  return r.ok?{data:r.body,error:null}:{data:null,error:r.body};
 }});
}
function marker(identity:ReservedIdentity){return Object.freeze({version:1,tenant_id:tenantId(identity.tenant_id),api_client_id:entityId(identity.api_client_id),environment:connectEnvironment(identity.environment)});}
function attest(value:unknown,identity:ReservedIdentity){
 const user=record(value),expected=marker(identity),actual=record(record(user.app_metadata).flexexa_machine_enrollment);
 exactKeys(actual,['version','tenant_id','api_client_id','environment']);
 if(entityId(user.id)!==entityId(identity.intended_auth_user_id)||user.is_anonymous!==false||
  user.deleted_at||user.banned_until&&Date.parse(String(user.banned_until))>Date.now()||
  Object.entries(expected).some(([key,v])=>actual[key]!==v))throw new DomainError('PERMISSION_DENIED');
 // SQL finalization also rejects human memberships, sessions and any previous binding.
}
/** Only constructed inside the trusted backend. No key, password or Auth body is returned. */
export function createReservedAuthAdmin(config:Connection,adminKey:string):ReservedAuthAdmin{
 const key=credential(adminKey),request=transport(config,{apikey:key,Authorization:'Bearer '+key});
 return Object.freeze({
  async find(identity:ReservedIdentity){
   const r=await request('/auth/v1/admin/users/'+entityId(identity.intended_auth_user_id),'GET');
   if(r.status===404&&record(r.body).error_code==='user_not_found')return false;
   if(!r.ok)throw new DomainError('INTERNAL_ERROR');attest(r.body,identity);return true;
  },
  async create(identity:ReservedIdentity){
   const id=entityId(identity.intended_auth_user_id);
   const r=await request('/auth/v1/admin/users','POST',{id,email:id+'@machine.flexexa.invalid',password:randomBytes(32).toString('base64url'),
    email_confirm:true,app_metadata:{flexexa_machine_enrollment:marker(identity)}});
   if(!r.ok)throw new DomainError('INTERNAL_ERROR');attest(r.body,identity);
  },
 });
}
