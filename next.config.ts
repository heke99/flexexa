import type { NextConfig } from "next";
import { httpsOrigin } from "./src/lib/https-origin.ts";
import { baseContentSecurityPolicy, siteContentSecurityPolicy } from "./src/lib/site-content-security-policy.ts";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const authOrigin = process.env.FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW === "true"
      ? httpsOrigin(process.env.FLEXEXA_CUSTOMER_AUTH_URL)
      : null;
    const policy = process.env.NODE_ENV === "production" ? siteContentSecurityPolicy(authOrigin) : baseContentSecurityPolicy;
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Content-Security-Policy", value: policy },
    ] }, {
      source: "/service-worker.js",
      headers: [{ key: "Cache-Control", value: "no-cache, max-age=0, must-revalidate" }],
    }];
  },
};
export default nextConfig;
