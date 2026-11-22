import "server-only";

import { customerAccountConfig } from "@/lib/customer-account-config";

const authErrors = ["MFA_REQUIRED", "RECOVERY_REQUIRED", "VERIFIED_EMAIL_REQUIRED"];
type AccountApiPath = "/v1/accounts" | `/v1/accounts/${string}/product-access`;

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readCustomerAccountApi(
  request: Request,
  path: AccountApiPath | null,
  normalize: (payload: unknown) => object | null,
) {
  const config = customerAccountConfig();
  if (!config) return respond({ error: "UNAVAILABLE" }, 404);

  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length >= 16391 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(authorization)) {
    return respond({ error: "UNAUTHENTICATED" }, 401);
  }
  if (!path) return respond({ error: "INVALID_INPUT" }, 400);

  try {
    const upstream = await fetch(new URL(path, config.apiUrl), {
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

    const payload = normalize(await upstream.json());
    return payload ? respond(payload) : respond({ error: "UNAVAILABLE" }, 503);
  } catch {
    return respond({ error: "UNAVAILABLE" }, 503);
  }
}
