import { customerAccountConfig } from "@/lib/customer-account-config";
import { accountRoleLabels, type CustomerAccount } from "@/lib/customer-accounts";

export const dynamic = "force-dynamic";

const authErrors = ["MFA_REQUIRED", "RECOVERY_REQUIRED", "VERIFIED_EMAIL_REQUIRED"];

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const config = customerAccountConfig();
  if (!config) return respond({ error: "UNAVAILABLE" }, 404);

  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length >= 16391 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(authorization)) {
    return respond({ error: "UNAUTHENTICATED" }, 401);
  }

  try {
    const upstream = await fetch(new URL("/v1/accounts", config.apiUrl), {
      headers: { Authorization: authorization, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    });
    if (upstream.status === 401) return respond({ error: "UNAUTHENTICATED" }, 401);
    if (upstream.status === 429) return respond({ error: "RATE_LIMITED" }, 429);
    if (upstream.status === 403) {
      const payload = await upstream.json().catch(() => null);
      const error = authErrors.includes(payload?.error) ? payload.error : "ACCESS_DENIED";
      return respond({ error }, 403);
    }
    if (!upstream.ok) return respond({ error: "UNAVAILABLE" }, 503);

    const payload = await upstream.json();
    if (!Array.isArray(payload?.items)) return respond({ error: "UNAVAILABLE" }, 503);
    const items: CustomerAccount[] = [];
    for (const account of payload.items) {
      if (!account || typeof account.id !== "string" || typeof account.name !== "string" ||
        !["personal", "business"].includes(account.kind) || !Object.hasOwn(accountRoleLabels, account.role)) {
        return respond({ error: "UNAVAILABLE" }, 503);
      }
      items.push({ id: account.id, name: account.name, kind: account.kind, role: account.role });
    }
    return respond({ items });
  } catch {
    return respond({ error: "UNAVAILABLE" }, 503);
  }
}
