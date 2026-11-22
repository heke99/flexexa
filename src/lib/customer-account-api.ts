import "server-only";

import { customerAccountConfig } from "@/lib/customer-account-config";
import type { RequestedProductKey } from "@/lib/customer-product-access";
import type { CustomerVehicleListPath } from "@/lib/customer-vehicles";

const authErrors = ["MFA_REQUIRED", "RECOVERY_REQUIRED", "VERIFIED_EMAIL_REQUIRED"];
type AccountApiPath = "/v1/accounts" | `/v1/accounts/${string}/product-access` |
  `/v1/accounts/${string}/orders?limit=10` | CustomerVehicleListPath;

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isSameOrigin(request: Request) {
  const authority = request.headers.get("host");
  const scheme = new URL(request.url).protocol;
  return !!authority && request.headers.get("origin") === `${scheme}//${authority}`;
}

export async function readCustomerAccountApi(
  request: Request,
  path: AccountApiPath | null,
  normalize: (payload: unknown) => object | null,
) {
  return customerAccountApi(request, path, normalize);
}

export async function requestCustomerProduct(request: Request, path: AccountApiPath | null, productKey: RequestedProductKey | null) {
  return customerAccountApi(request, productKey ? path : null, (payload) => {
    if (!payload || typeof payload !== "object" || !("requested" in payload) || !("productKey" in payload) ||
      payload.requested !== true || payload.productKey !== productKey) return null;
    return { requested: true, productKey };
  }, productKey ?? undefined);
}

async function customerAccountApi(
  request: Request,
  path: AccountApiPath | null,
  normalize: (payload: unknown) => object | null,
  requestedProduct?: RequestedProductKey,
) {
  const config = customerAccountConfig();
  if (!config) return respond({ error: "UNAVAILABLE" }, 404);

  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length >= 16391 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(authorization)) {
    return respond({ error: "UNAUTHENTICATED" }, 401);
  }
  if (!path) return respond({ error: "INVALID_INPUT" }, 400);
  if (requestedProduct && !isSameOrigin(request)) {
    return respond({ error: "ACCESS_DENIED" }, 403);
  }

  try {
    const upstream = await fetch(new URL(path, config.apiUrl), {
      method: requestedProduct ? "POST" : "GET",
      headers: { Authorization: authorization, Accept: "application/json",
        ...(requestedProduct ? { "Content-Type": "application/json" } : {}) },
      ...(requestedProduct ? { body: JSON.stringify({ productKey: requestedProduct }) } : {}),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10000)]),
    });
    if (upstream.status === 401) return respond({ error: "UNAUTHENTICATED" }, 401);
    if (upstream.status === 429) return respond({ error: "RATE_LIMITED" }, 429);
    if (upstream.status === 400 && (await upstream.json().catch(() => null))?.error === "INVALID_CURSOR") {
      return respond({ error: "INVALID_CURSOR" }, 400);
    }
    if (upstream.status === 403) {
      const payload = await upstream.json().catch(() => null);
      const error = authErrors.includes(payload?.error) ? payload.error : "ACCESS_DENIED";
      return respond({ error }, 403);
    }
    if (!upstream.ok || (requestedProduct && upstream.status !== 202)) return respond({ error: "UNAVAILABLE" }, 503);

    const payload = normalize(await upstream.json());
    return payload ? respond(payload, requestedProduct ? 202 : 200) : respond({ error: "UNAVAILABLE" }, 503);
  } catch {
    return respond({ error: "UNAVAILABLE" }, 503);
  }
}
