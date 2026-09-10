import {context,propagation,ROOT_CONTEXT,SpanKind,SpanStatusCode,trace} from '@opentelemetry/api';
import {NodeTracerProvider} from '@opentelemetry/sdk-trace-node';
import {BatchSpanProcessor,TraceIdRatioBasedSampler} from '@opentelemetry/sdk-trace-base';
import {resourceFromAttributes} from '@opentelemetry/resources';
import {OTLPTraceExporter} from '@opentelemetry/exporter-trace-otlp-http';

export function startTelemetry(endpoint:string|undefined,environment:string,sampleRatio=0.1){
 if(endpoint===undefined)return {forceFlush:async()=>{},shutdown:async()=>{}};
 const url=new URL(endpoint);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/v1/traces'||
  !(url.protocol==='https:'||url.protocol==='http:'&&url.hostname==='127.0.0.1')||
  !Number.isFinite(sampleRatio)||sampleRatio<0||sampleRatio>1||!['sandbox','production'].includes(environment))throw Error('TELEMETRY_CONFIGURATION_INVALID');
 const exporter=new OTLPTraceExporter({url:url.href,timeoutMillis:1000,concurrencyLimit:1});
 const provider=new NodeTracerProvider({resource:resourceFromAttributes({'service.name':'flexexa-identity','service.version':'0.0.0','deployment.environment.name':environment}),
  sampler:new TraceIdRatioBasedSampler(sampleRatio),spanLimits:{attributeCountLimit:16,attributeValueLengthLimit:128,eventCountLimit:0,linkCountLimit:0},
  spanProcessors:[new BatchSpanProcessor(exporter,{maxQueueSize:256,maxExportBatchSize:32,scheduledDelayMillis:500,exportTimeoutMillis:1500})]});
 provider.register();
 return {forceFlush:()=>provider.forceFlush(),shutdown:async()=>{try{await provider.shutdown();}catch{/* Telemetry failure cannot reverse a committed operation. */}}};
}

export function serverTrace(parent:unknown,route:string,method:string,requestId:string,correlationId:string){
 // Extract traceparent only. Baggage, tracestate, cookies and arbitrary headers never enter a span.
 const carrier=typeof parent==='string'&&/^00-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/u.test(parent)?{traceparent:parent}:{};
 const parentContext=propagation.extract(ROOT_CONTEXT,carrier);
 const span=trace.getTracer('flexexa.identity','1').startSpan(method+' '+route,{kind:SpanKind.SERVER,
  attributes:{'http.request.method':method,'http.route':route,'flexexa.request_id':requestId,'flexexa.correlation_id':correlationId}},parentContext);
 return {span,run:<T>(fn:()=>T)=>context.with(trace.setSpan(parentContext,span),fn)};
}

export async function tracedUpstream<T extends {status:number}>(kind:'rpc'|'auth',send:(headers:Record<string,string>)=>Promise<T>){
 return trace.getTracer('flexexa.identity','1').startActiveSpan('supabase.'+kind,{kind:SpanKind.CLIENT},async span=>{
  const carrier:Record<string,string>={};propagation.inject(context.active(),carrier);
  // Never propagate baggage or vendor state, even if another component installed it globally.
  const headers=carrier.traceparent?{traceparent:carrier.traceparent}:{};
  try{const result=await send(headers);span.setAttribute('http.response.status_code',result.status);
   if(result.status>=500)span.setStatus({code:SpanStatusCode.ERROR});return result;
  }catch(error){span.setStatus({code:SpanStatusCode.ERROR});throw error;}finally{span.end();}
 });
}
