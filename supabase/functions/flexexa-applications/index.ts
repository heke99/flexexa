const serverActions = new Set(["stats", "submit", "claim_email", "finish_email", "cleanup"]);
const adminActions = new Set(["owner_login", "admin_list"]);
const tokenPattern = /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/;
const actorPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const noStore = { "Cache-Control": "no-store" };

function error(code: string, status: number) {
 return Response.json({ error: code }, { status, headers: noStore });
}

function rateLimited(upstream: Response) {
 const retry = upstream.headers.get("retry-after");
 const headers = new Headers(noStore);
 if (retry !== null && /^\d{1,5}$/.test(retry) && Number(retry) <= 86400) headers.set("Retry-After", retry);
 return Response.json({ error: "RATE_LIMITED" }, { status: 429, headers });
}

export async function handleApplications(request: Request) {
 if (request.method !== "POST") return error("METHOD_NOT_ALLOWED", 405);
 if (Number(request.headers.get("content-length")) > 16384) return error("INVALID_INPUT", 413);
 let input;
 try {
  const body = await request.text();
  if (body.length > 16384) return error("INVALID_INPUT", 413);
  input = JSON.parse(body);
 } catch {
  return error("INVALID_INPUT", 400);
 }
 if (!input || typeof input.action !== "string" ||
   (!serverActions.has(input.action) && !adminActions.has(input.action)) ||
   typeof input.secret !== "string" || input.secret.length !== 64 ||
   !input.data || typeof input.data !== "object" || Array.isArray(input.data)) {
  return error("INVALID_INPUT", 400);
 }

 const url = Deno.env.get("SUPABASE_URL");
 const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if (!url || !service) return error("APPLICATIONS_NOT_CONFIGURED", 503);

 try {
  const admin = adminActions.has(input.action);
  let actor: string | undefined;
  if (admin) {
   const authorization = request.headers.get("authorization");
   if (!authorization || authorization.length > 16391 || !tokenPattern.test(authorization)) {
    return error("UNAUTHENTICATED", 401);
   }
   const auth = await fetch(url + "/auth/v1/user", {
    headers: { apikey: service, Authorization: authorization },
    redirect: "error", signal: AbortSignal.timeout(5000),
   });
   if (auth.status === 401 || auth.status === 403) return error("UNAUTHENTICATED", 401);
   if (auth.status === 429) return rateLimited(auth);
   if (!auth.ok) return error("AUTH_UNAVAILABLE", 503);
   const user = await auth.json().catch(() => null);
   if (typeof user?.id !== "string" || !actorPattern.test(user.id)) {
    return error("INVALID_AUTH_RESPONSE", 502);
   }
   actor = user.id;
  }

  const result = await fetch(url + "/rest/v1/rpc/" + (admin ? "flexexa_applications_admin" : "flexexa_applications"), {
   method: "POST",
   headers: { apikey: service, Authorization: "Bearer " + service, "Content-Type": "application/json" },
   body: JSON.stringify({ p_action: input.action, p_secret: input.secret, p_data: input.data, ...(admin && { p_actor: actor }) }),
   redirect: "error", signal: AbortSignal.timeout(6000),
  });
  if (result.status === 429) return rateLimited(result);
  if (admin && result.status === 403) return error("ACCESS_DENIED", 403);
  if (!result.ok) return error("DATABASE_UNAVAILABLE", 503);
  try {
   return Response.json(await result.json(), { headers: noStore });
  } catch {
   return error("INVALID_DATABASE_RESPONSE", 502);
  }
 } catch (cause) {
  if (cause instanceof Error && (cause.name === "TimeoutError" || cause.name === "AbortError")) {
   return error("UPSTREAM_TIMEOUT", 504);
  }
  return error("UPSTREAM_UNAVAILABLE", 503);
 }
}

Deno.serve(handleApplications);
