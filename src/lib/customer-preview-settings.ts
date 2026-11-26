import { httpsOrigin } from "./https-origin.ts";

type Environment = Record<string, string | undefined>;

export function inspectCustomerPreview(env: Environment) {
  const preview = env.FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW;
  const emailOtp = env.FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW;
  const issues = [];
  if (preview !== undefined && preview !== "true" && preview !== "false") issues.push("FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW");
  if ((emailOtp !== undefined && emailOtp !== "true" && emailOtp !== "false") || (emailOtp === "true" && preview !== "true")) {
    issues.push("FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW");
  }
  if (issues.length) return { state: "invalid" as const, issues };
  if (preview !== "true") return { state: "disabled" as const };

  const authUrl = httpsOrigin(env.FLEXEXA_CUSTOMER_AUTH_URL);
  const apiUrl = httpsOrigin(env.FLEXEXA_CUSTOMER_API_URL);
  const publishableKey = env.FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY;
  if (!authUrl) issues.push("FLEXEXA_CUSTOMER_AUTH_URL");
  if (!apiUrl) issues.push("FLEXEXA_CUSTOMER_API_URL");
  if (!publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) issues.push("FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY");
  if (!authUrl || !apiUrl || !publishableKey || issues.length) return { state: "invalid" as const, issues };
  return { state: "enabled" as const, config: { authUrl, apiUrl, publishableKey, emailOtpEnabled: emailOtp === "true" } };
}
