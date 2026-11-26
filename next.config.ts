import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { inspectCustomerPreview } from "./src/lib/customer-preview-settings.ts";
import { baseContentSecurityPolicy, siteContentSecurityPolicy } from "./src/lib/site-content-security-policy.ts";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const preview = inspectCustomerPreview(process.env);
    const authOrigin = preview.state === "enabled" ? preview.config.authUrl : null;
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
export default function config(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const preview = inspectCustomerPreview(process.env);
    if (preview.state === "invalid") {
      throw new Error(`CUSTOMER_PREVIEW_CONFIGURATION_INVALID ${preview.issues.join(",")}`);
    }
  }
  return nextConfig;
}
