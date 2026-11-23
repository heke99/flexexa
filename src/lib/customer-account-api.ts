import "server-only";

import { customerAccountConfig } from "@/lib/customer-account-config";
import { isCustomerResourceId } from "@/lib/customer-accounts";
import type { RequestedProductKey } from "@/lib/customer-product-access";
import type { CustomerVehicleListPath } from "@/lib/customer-vehicles";

const authErrors = ["MFA_REQUIRED", "RECOVERY_REQUIRED", "VERIFIED_EMAIL_REQUIRED"];
type AccountApiPath = "/v1/accounts" | `/v1/accounts/${string}/product-access` |
  `/v1/accounts/${string}/orders?limit=10` | CustomerVehicleListPath;
type AccountWrite = { status: 201 | 202; body: () => object | Response | Promise<object | Response> };

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
  const config = customerAccountConfig();
  if (!config) return respond({ error: "UNAVAILABLE" }, 404);

  const authorization = request.headers.get("authorization");
  if (!authorization || authorization.length >= 16391 || !/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(authorization)) {
    return respond({ error: "UNAUTHENTICATED" }, 401);
  }
  if (!path) return respond({ error: "INVALID_INPUT" }, 400);
  if (write && !isSameOrigin(request)) {
    return respond({ error: "ACCESS_DENIED" }, 403);
  }

  try {
    const body = await write?.body();
    if (body instanceof Response) return body;
    const upstream = await fetch(new URL(path, config.apiUrl), {
      method: write ? "POST" : "GET",
      headers: { Authorization: authorization, Accept: "application/json",
        ...(write ? { "Content-Type": "application/json" } : {}) },
      ...(write ? { body: JSON.stringify(body) } : {}),
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
    if (upstream.status === 409 && write?.status === 201) return respond({ error: "PERSONAL_ACCOUNT_UNAVAILABLE" }, 409);
    if (!upstream.ok || (write && upstream.status !== write.status)) return respond({ error: "UNAVAILABLE" }, 503);

    const payload = normalize(await upstream.json());
    return payload ? respond(payload, write?.status ?? 200) : respond({ error: "UNAVAILABLE" }, 503);
  } catch {
    return respond({ error: "UNAVAILABLE" }, 503);
  }
}
