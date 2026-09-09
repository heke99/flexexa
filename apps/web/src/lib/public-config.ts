/** Browser-safe values only. Never pass a full environment object here. */
export function publicConnectionConfig(url: unknown, publishableKey: unknown) {
  if (typeof url !== "string" || typeof publishableKey !== "string" || !/^sb_publishable_[A-Za-z0-9_-]+$/u.test(publishableKey)) throw new Error("INVALID_PUBLIC_CONFIG");
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
  if ((parsed.protocol !== "https:" && !(local && parsed.protocol === "http:")) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== "/") throw new Error("INVALID_PUBLIC_CONFIG");
  return Object.freeze({ url: parsed.origin, publishable_key: publishableKey });
}
