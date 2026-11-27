import "server-only";

import { randomUUID } from "node:crypto";
import { inspectCustomerPreview } from "@/lib/customer-preview-settings";
import { isCustomerResourceId } from "@/lib/customer-accounts";
import type { RequestedProductKey } from "@/lib/customer-product-access";
import type { CustomerVehicleListPath } from "@/lib/customer-vehicles";

const authErrors = ["MFA_REQUIRED", "RECOVERY_REQUIRED", "VERIFIED_EMAIL_REQUIRED"];
type AccountApiPath = "/v1/accounts" | `/v1/accounts/${string}/product-access` |
  `/v1/accounts/${string}/orders?limit=10` | CustomerVehicleListPath |
  `/v1/accounts/${string}/sessions?limit=10` | `/v1/accounts/${string}/sessions/${string}`;
type AccountWrite = { status: 201 | 202; body: () => object | Response | Promise<object | Response> };
type TechnicalClass = "CONFIGURATION_INVALID" | "COMMERCE_TIMEOUT" | "COMMERCE_INVALID_RESPONSE" |
  "COMMERCE_REJECTED" | "COMMERCE_UNAVAILABLE" | "COMMERCE_TRANSPORT";

function respond(body: object, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
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
    default: return request.method === "POST" ? "account-create" : "accounts";
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
  }, productKey ? { status: 202, body: () => ({ productKey }) } : undefined);
}

export async function createCustomerPersonalAccount(request: Request) {
  return customerAccountApi(request, "/v1/accounts", payload => {
    if (!payload || typeof payload !== "object" || !("id" in payload) || !("kind" in payload) || !("name" in payload) ||
      !isCustomerResourceId(payload.id) || payload.kind !== "personal" || !validAccountName(payload.name)) return null;
    return { id: payload.id, kind: payload.kind, name: payload.name };
  }, { status: 201, body: () => accountCreationBody(request) });
}

function validAccountName(name: unknown): name is string {
  return typeof name === "string" && name.trim().length > 0 && name.trim().length <= 160;
}

async function accountCreationBody(request: Request) {
  if (new URL(request.url).search) return respond({ error: "INVALID_INPUT" }, 400);
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return respond({ error: "JSON_REQUIRED" }, 415);
  const reader = request.body?.getReader();
  if (!reader) return respond({ error: "INVALID_INPUT" }, 400);
  const bytes = new Uint8Array(2048);
  let offset = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (offset + value.byteLength > bytes.length) {
        await reader.cancel();
        return respond({ error: "BODY_TOO_LARGE" }, 413);
      }
      bytes.set(value, offset);
      offset += value.byteLength;
    }
    const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, offset)));
    if (payload && Object.keys(payload).length === 1 && validAccountName(payload.name)) return { name: payload.name.trim() };
    return respond({ error: "INVALID_INPUT" }, 400);
  } catch {
    return respond({ error: "INVALID_INPUT" }, 400);
  } finally {
    reader.releaseLock();
  }
}

async function customerAccountApi(
  request: Request,
  path: AccountApiPath | null,
  normalize: (payload: unknown) => object | null,
  write?: AccountWrite,
) {
  const requestId = randomUUID();
  const attachId = (response: Response) => {
    response.headers.set("X-Request-ID", requestId);
    return response;
  };
  const send = (body: object, status: number) => attachId(respond(body, status));
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
  if (write && !isSameOrigin(request)) {
    return send({ error: "ACCESS_DENIED" }, 403);
  }

  const deadline = AbortSignal.timeout(10000);
  try {
    const body = await write?.body();
    if (body instanceof Response) return attachId(body);
    const signal = AbortSignal.any([request.signal, deadline]);
    const upstream = await fetch(new URL(path, config.apiUrl), {
      method: write ? "POST" : "GET",
      headers: { Authorization: authorization, Accept: "application/json",
        ...(write ? { "Content-Type": "application/json" } : {}) },
      ...(write ? { body: JSON.stringify(body) } : {}),
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
    if (upstream.status === 409 && write?.status === 201) return send({ error: "PERSONAL_ACCOUNT_UNAVAILABLE" }, 409);
    if (!upstream.ok) return technicalFailure(upstream.status >= 500 ? "COMMERCE_UNAVAILABLE" : "COMMERCE_REJECTED", 503, upstream.status);
    if (write && upstream.status !== write.status) return technicalFailure("COMMERCE_INVALID_RESPONSE", 503, upstream.status);

    try {
      const payload = normalize(await upstream.json());
      return payload ? send(payload, write?.status ?? 200) : technicalFailure("COMMERCE_INVALID_RESPONSE", 503, upstream.status);
    } catch {
      if (request.signal.aborted) return send({ error: "UNAVAILABLE" }, 503);
      return technicalFailure(deadline.aborted ? "COMMERCE_TIMEOUT" : "COMMERCE_INVALID_RESPONSE", 503, upstream.status);
    }
  } catch {
    if (request.signal.aborted) return send({ error: "UNAVAILABLE" }, 503);
    return technicalFailure(deadline.aborted ? "COMMERCE_TIMEOUT" : "COMMERCE_TRANSPORT");
  }
}
