import {randomUUID} from 'node:crypto';
import {Console} from 'node:console';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {entityId} from '@flexexa/domain';

export interface RequestLog {
 readonly event:'http.request.completed';
 readonly service:'identity-service';
 readonly request_id:string;
 readonly correlation_id:string;
 readonly route:'/health/live'|'/v1/identity/provisioning/execute'|'unmatched';
 readonly method:'GET'|'POST'|'other';
 readonly status_code:number;
 readonly duration_ms:number;
 readonly outcome:'completed'|'aborted';
}
export type LogSink=(entry:RequestLog)=>void;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const diagnostics=new Console({stdout:process.stdout,stderr:process.stderr,ignoreErrors:true});
export function writeRequestLog(entry:RequestLog){
 // Bounded best-effort diagnostics; PostgreSQL remains the durable audit authority.
 if(process.stdout.writableLength<65536)diagnostics.log(JSON.stringify(entry));
}
export function observeRequest(request:IncomingMessage,response:ServerResponse,sink:LogSink=writeRequestLog){
 const requestId=randomUUID(),header=request.headers['x-correlation-id'];
 let correlationId=typeof header==='string'&&uuid.test(header)?header.toLowerCase():requestId;
 const started=performance.now();let emitted=false;
 const route=request.url==='/health/live'?'/health/live':request.url==='/v1/identity/provisioning/execute'?'/v1/identity/provisioning/execute':'unmatched';
 const method=request.method==='GET'?'GET':request.method==='POST'?'POST':'other';
 response.setHeader('X-Request-Id',requestId);response.setHeader('X-Correlation-Id',correlationId);
 const emit=(outcome:'completed'|'aborted')=>{
  if(emitted)return;emitted=true;
  const entry:RequestLog=Object.freeze({event:'http.request.completed',service:'identity-service',request_id:requestId,
   correlation_id:correlationId,route,method,status_code:outcome==='aborted'?499:response.statusCode,
   duration_ms:Math.max(0,Math.round((performance.now()-started)*1000)/1000),outcome});
  try{sink(entry);}catch{/* Diagnostics must not change a business transaction's outcome. */}
 };
 response.once('finish',()=>emit('completed'));response.once('close',()=>emit(response.writableFinished?'completed':'aborted'));
 return Object.freeze({get correlationId(){return correlationId;},setCorrelationId(value:string){
  // Only a canonical, already parsed UUID is passed here; never raw payload/header text.
  correlationId=entityId(value);response.setHeader('X-Correlation-Id',correlationId);
 }});
}
