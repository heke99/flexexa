import "server-only";

import { randomUUID } from "node:crypto";
import { inspectCustomerPreview } from "@/lib/customer-preview-settings";
import type { RequestedProductKey } from "@/lib/customer-product-access";
import type { CustomerVehicleListPath } from "@/lib/customer-vehicles";

const authErrors = ["MFA_REQUIRED", "RECOVERY_REQUIRED", "VERIFIED_EMAIL_REQUIRED"];
type AccountApiPath = "/v1/accounts" | `/v1/accounts/${string}/product-access` |
  `/v1/accounts/${string}/orders?limit=10` | CustomerVehicleListPath |
  `/v1/accounts/${string}/sessions?limit=10` | `/v1/accounts/${string}/sessions/${string}`;
type TechnicalClass = "CONFIGURATION_INVALID" | "COMMERCE_TIMEOUT" | "COMMERCE_INVALID_RESPONSE" |
  "COMMERCE_REJECTED" | "COMMERCE_UNAVAILABLE" | "COMMERCE_TRANSPORT";

function respond(body: object, status: number, requestId: string) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", "X-Request-ID": requestId } });
}

function isSameOrigin(request: Request) {
  const authority = request.headers.get("host");
  const scheme = new URL(request.url).protocol;
  return !!authority && request.headers.get("origin") === `${scheme}//${authority}`;
}

function customerRouteType(request: Request) {
  const [, , , , resource, detail] = new URL(request.url).pathname.split("/");
  switch (resource) {
    case "produkter": return detail ? "product-request" : "products";
    case "bestallningar": return "orders";
    case "fordon": return "vehicles";
    case "laddningar": return detail ? "session-detail" : "sessions";
    default: return "accounts";
  }
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
  const requestId = randomUUID();
  const send = (body: object, status: number) => respond(body, status, requestId);
  const technicalFailure = (technicalClass: TechnicalClass, status = 503, upstreamStatus?: number, fields?: string[]) => {
    console.error(JSON.stringify({ event: "customer_api_failure", requestId, route: customerRouteType(request), technicalClass,
      ...(upstreamStatus === undefined ? {} : { upstreamStatus }), ...(fields ? { fields } : {}) }));
    const response = send({ error: "UNAVAILABLE" }, status);
    response.headers.set("X-Flexexa-Error-Class", technicalClass);
    return response;
  };

  const preview = inspectCustomerPreview(process.env);
  if (preview.state === "invalid") return technicalFailure("CONFIGURATION_INVALID", 404, undefined, preview.issues);
  if (preview.state === "disabled") return send({ error: "UNAVAILABLE" }, 404);
  const { config } = preview;

  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length >= 16391 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(authorization)) {
    return send({ error: "UNAUTHENTICATED" }, 401);
  }
  if (!path) return send({ error: "INVALID_INPUT" }, 400);
  if (requestedProduct && !isSameOrigin(request)) {
    return send({ error: "ACCESS_DENIED" }, 403);
  }

  const deadline = AbortSignal.timeout(10000);
  try {
    const signal = AbortSignal.any([request.signal, deadline]);
    const upstream = await fetch(new URL(path, config.apiUrl), {
      method: requestedProduct ? "POST" : "GET",
      headers: { Authorization: authorization, Accept: "application/json",
        ...(requestedProduct ? { "Content-Type": "application/json" } : {}) },
      ...(requestedProduct ? { body: JSON.stringify({ productKey: requestedProduct }) } : {}),
      cache: "no-store",
      redirect: "error",
      signal,
    });
    if (upstream.status === 401) return send({ error: "UNAUTHENTICATED" }, 401);
    if (upstream.status === 429) {
      const response = send({ error: "RATE_LIMITED" }, 429);
      const retry = upstream.headers.get("retry-after");
      if (retry && /^\d{1,5}$/.test(retry) && Number(retry) <= 86400) response.headers.set("Retry-After", retry);
      return response;
    }
    if (upstream.status === 404 && path.includes("/sessions/")) return send({ error: "NOT_FOUND" }, 404);
    if (upstream.status === 400 || upstream.status === 403) {
      const payload = await upstream.json().catch(() => {
        signal.throwIfAborted();
        return null;
      });
      if (upstream.status === 403) {
        const error = authErrors.includes(payload?.error) ? payload.error : "ACCESS_DENIED";
        return send({ error }, 403);
      }
      if (payload?.error === "INVALID_CURSOR") return send({ error: "INVALID_CURSOR" }, 400);
    }
    if (!upstream.ok) return technicalFailure(upstream.status >= 500 ? "COMMERCE_UNAVAILABLE" : "COMMERCE_REJECTED", 503, upstream.status);
    if (requestedProduct && upstream.status !== 202) return technicalFailure("COMMERCE_INVALID_RESPONSE", 503, upstream.status);

    try {
      const payload = normalize(await upstream.json());
      return payload ? send(payload, requestedProduct ? 202 : 200) : technicalFailure("COMMERCE_INVALID_RESPONSE", 503, upstream.status);
    } catch {
      if (request.signal.aborted) return send({ error: "UNAVAILABLE" }, 503);
      return technicalFailure(deadline.aborted ? "COMMERCE_TIMEOUT" : "COMMERCE_INVALID_RESPONSE", 503, upstream.status);
    }
  } catch {
    if (request.signal.aborted) return send({ error: "UNAVAILABLE" }, 503);
    return technicalFailure(deadline.aborted ? "COMMERCE_TIMEOUT" : "COMMERCE_TRANSPORT");
  }
}
