export const baseContentSecurityPolicy = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";

export function siteContentSecurityPolicy(customerAuthOrigin: string | null) {
  const connectSources = customerAuthOrigin ? `'self' ${customerAuthOrigin}` : "'self'";
  return [
    baseContentSecurityPolicy,
    "default-src 'self'",
    // Static App Router pages use inline bootstrap scripts. Inline event
    // attributes and evaluation through unsafe-eval remain blocked.
    "script-src 'self' 'unsafe-inline'",
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "frame-src 'none'",
    "form-action 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    `connect-src ${connectSources}`,
  ].join("; ");
}
