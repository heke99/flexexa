import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
export function settings(){const url=process.env.FLEXEXA_SUPABASE_URL;const key=process.env.FLEXEXA_SUPABASE_KEY;const secret=process.env.FLEXEXA_WAITLIST_SECRET;if(!url||!key||!secret)throw Error("APPLICATIONS_NOT_CONFIGURED");return {url,key,secret};}
type ServerAction = "stats" | "submit" | "claim_email" | "finish_email" | "cleanup";
type AdminAction = "owner_login" | "admin_list";

export class ApplicationError extends Error {
 readonly code: string;
 readonly status: number;
 readonly retryAfter: string | undefined;

 constructor(code: string, status: number, retryAfter?: string) {
  super(code);
  this.code = code;
  this.status = status;
  this.retryAfter = retryAfter;
 }
}

export function limitedApplicationResponse(response: Response) {
 const retry = response.headers.get("retry-after");
 const seconds = retry !== null && /^\d{1,5}$/.test(retry) ? Number(retry) : undefined;
 return new ApplicationError("RATE_LIMITED", 429, seconds !== undefined && seconds <= 86400 ? String(seconds) : undefined);
}

async function callRpc<T>(action: ServerAction | AdminAction, data: Record<string, unknown>, token?: string): Promise<T> {
 const { url, key, secret } = settings();
 let response: Response;
 try {
  response = await fetch(url + "/functions/v1/flexexa-applications", {
   method: "POST",
   headers: { apikey: key, ...(token && { Authorization: `Bearer ${token}` }), "Content-Type": "application/json" },
   body: JSON.stringify({ action, secret, data }),
   cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
  });
 } catch (error) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
   throw new ApplicationError("UPSTREAM_TIMEOUT", 504);
  }
  throw new ApplicationError("UPSTREAM_UNAVAILABLE", 503);
 }
 if (token && response.status === 401) throw new ApplicationError("UNAUTHENTICATED", 401);
 if (token && response.status === 403) throw new ApplicationError("ACCESS_DENIED", 403);
 if (response.status === 429) throw limitedApplicationResponse(response);
 if (response.status === 502) throw new ApplicationError("INVALID_GATEWAY_RESPONSE", 502);
 if (response.status === 504) throw new ApplicationError("UPSTREAM_TIMEOUT", 504);
 if (!response.ok) throw new ApplicationError("DATABASE_UNAVAILABLE", 503);
 try { return await response.json(); }
 catch { throw new ApplicationError("INVALID_DATABASE_RESPONSE", 502); }
}

export function rpc<T = Record<string, unknown>>(action: ServerAction, data: Record<string, unknown> = {}): Promise<T> {
 return callRpc<T>(action, data);
}

export async function adminRpc<T = Record<string, unknown>>(action: AdminAction, token: string, data: Record<string, unknown> = {}): Promise<T> {
 if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token) || token.length > 16384) {
  throw new ApplicationError("UNAUTHENTICATED", 401);
 }
 return callRpc<T>(action, data, token);
}

export function reportApplicationFailure(action: string, error: unknown) {
 const failure = error instanceof ApplicationError ? error : new ApplicationError("APPLICATION_FAILURE", 503);
 const requestId = crypto.randomUUID();
 console.error(JSON.stringify({ event: "applications.failure", action, code: failure.code, requestId }));
 const headers = new Headers({ "Cache-Control": "no-store" });
 if (failure.retryAfter !== undefined) headers.set("Retry-After", failure.retryAfter);
 return { failure, requestId, headers };
}

export function networkHash(request: Request) {
 // Vercel owns this header at its ingress. Every other environment shares a
 // conservative bucket until it has an explicitly configured trusted source.
 const address = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined;
 const identity = address && isIP(address) ? address : "unknown";
 return createHmac("sha256", settings().secret).update("applications-network:" + identity).digest("hex");
}
export function validOrigin(request:Request){return request.headers.get("origin")===new URL(request.url).origin;}
export async function sendPendingEmails(max = 5) {
 let sent = 0;
 for (let i = 0; i < max; i++) {
  const job = await rpc<{ id: string; claim_token: string; payload: unknown } | null>("claim_email");
  if (!job) break;

  let outcome = "retry";
  let error = "TRANSPORT_UNCERTAIN";
  let providerId: string | undefined;
  try {
   const key = process.env.RESEND_API_KEY;
   if (!key) throw new ApplicationError("EMAIL_NOT_CONFIGURED", 503);
   const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
     Authorization: `Bearer ${key}`,
     "Content-Type": "application/json",
     "Idempotency-Key": `flexexa-application-${job.id}`,
    },
    body: JSON.stringify(job.payload),
    redirect: "error",
    signal: AbortSignal.timeout(12000),
   });
   if (response.ok) {
    const result = await response.json();
    if (typeof result?.id !== "string" || !/^[\w-]{1,100}$/.test(result.id)) {
     throw new ApplicationError("INVALID_EMAIL_RECEIPT", 502);
    }
    providerId = result.id;
    outcome = "sent";
    error = "";
   } else {
    outcome = response.status === 429 || response.status >= 500 ? "retry" : "permanent";
    error = `EMAIL_HTTP_${response.status}`;
   }
  } catch (cause) {
   // A timeout is uncertain. Preserve the same idempotency key for a bounded retry.
   const { failure } = reportApplicationFailure("send_email", cause instanceof ApplicationError ? cause : new ApplicationError("TRANSPORT_UNCERTAIN", 503));
   error = failure.code;
  }

  const completion = await rpc<{ updated: number } | null>("finish_email", {
   id: job.id,
   claim_token: job.claim_token,
   outcome,
   error,
   ...(providerId && { provider_id: providerId }),
  });
  if (completion?.updated !== 0 && completion?.updated !== 1) {
   throw new ApplicationError("INVALID_EMAIL_COMPLETION", 502);
  }
  if (completion.updated === 1 && outcome === "sent") sent++;
  if (outcome === "retry") break;
 }
 return sent;
}
