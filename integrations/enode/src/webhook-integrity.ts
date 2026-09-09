import { DomainError, entityId } from "@flexexa/domain";

/** SHA-1 here is Enode's documented HMAC transport contract, NOT a new security choice.
 * This helper does not ACK, route tenants, parse events or persist a receipt.
 */
export async function verifyEnodeDelivery(
  rawBody: Uint8Array, signature: unknown, secret: string, trustedSubscriptionId: unknown, maxBodyBytes: number,
) {
  const subscription = entityId(trustedSubscriptionId);
  if (!Number.isSafeInteger(maxBodyBytes) || maxBodyBytes < 1 || maxBodyBytes > 16 * 1024 * 1024 ||
      !(rawBody instanceof Uint8Array) || rawBody.length > maxBodyBytes || rawBody.length === 0) {
    throw new DomainError("VALIDATION_ERROR");
  }
  if (typeof secret !== "string" || secret.length === 0 || secret.length > 4096) throw new DomainError("VALIDATION_ERROR");
  if (typeof signature !== "string" || !/^sha1=[0-9a-f]{40}$/u.test(signature)) throw new DomainError("PERMISSION_DENIED");
  // Snapshot before the first await: mutation by a caller cannot swap verified bytes.
  const payload = new Uint8Array(rawBody), expected = new Uint8Array(20);
  for (let i = 0; i < expected.length; i++) expected[i] = Number.parseInt(signature.slice(5 + i * 2, 7 + i * 2), 16);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-1" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, expected, payload);
  if (!valid) throw new DomainError("PERMISSION_DENIED");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", payload));
  const payload_sha256 = [...digest].map(value => value.toString(16).padStart(2, "0")).join("");
  let payload_utf8: string;
  try { payload_utf8 = new TextDecoder("utf-8", { fatal: true }).decode(payload); }
  catch { throw new DomainError("VALIDATION_ERROR"); }
  return Object.freeze({ payload_utf8, payload_sha256,
    // x-enode-delivery is not covered by the documented body signature. Never use
    // that header alone for replay protection: keep an atomic, durable inbox key.
    deduplication_key: JSON.stringify(["enode", subscription, payload_sha256]),
  });
}
