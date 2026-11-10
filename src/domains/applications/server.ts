import "server-only";
import { createHash } from "node:crypto";
export function settings(){const url=process.env.FLEXEXA_SUPABASE_URL;const key=process.env.FLEXEXA_SUPABASE_KEY;const secret=process.env.FLEXEXA_WAITLIST_SECRET;if(!url||!key||!secret)throw Error("APPLICATIONS_NOT_CONFIGURED");return {url,key,secret};}
export async function rpc<T=Record<string,unknown>>(action:string,data:Record<string,unknown>={},token?:string):Promise<T>{const c=settings();const response=await fetch(c.url+"/rest/v1/rpc/flexexa_applications",{method:"POST",headers:{apikey:c.key,"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify({p_action:action,p_secret:c.secret,p_data:data}),cache:"no-store",signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(response.status===403||response.status===401?"ACCESS_DENIED":"DATABASE_UNAVAILABLE");return response.json();}
export function networkHash(value:string){return createHash("sha256").update(settings().secret+new Date().toISOString().slice(0,10)+value).digest("hex");}
export function validOrigin(request:Request){return request.headers.get("origin")===new URL(request.url).origin;}
export async function sendPendingEmails(max=5){let sent=0;for(let i=0;i<max;i++){
 const job=await rpc<{id:string;claim_token:string;payload:unknown}|null>("claim_email");if(!job)break;
 let outcome="retry",error="TRANSPORT_UNCERTAIN",provider_id:string|undefined;
 try{const key=process.env.RESEND_API_KEY;if(!key)throw Error("EMAIL_NOT_CONFIGURED");const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json","Idempotency-Key":`flexexa-application-${job.id}`},body:JSON.stringify(job.payload),signal:AbortSignal.timeout(12000)});
 if(response.ok){const result=await response.json();if(typeof result.id!=="string")throw Error("INVALID_EMAIL_RECEIPT");provider_id=result.id;outcome="sent";error="";sent++;}else{outcome=response.status===429||response.status>=500?"retry":"permanent";error=`EMAIL_HTTP_${response.status}`;}
 }catch{/* A timeout is uncertain; preserve the same idempotency key for a bounded retry. */}
 await rpc("finish_email",{id:job.id,claim_token:job.claim_token,outcome,error,...(provider_id?{provider_id}:{})});
 if(outcome!=="sent")break;
 }return sent;}
