import "server-only";

function httpsOrigin(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password &&
      (value === url.origin || value === `${url.origin}/`) ? url.origin : null;
  } catch {
    return null;
  }
}

export function customerAccountConfig() {
  if (process.env.FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW !== "true") return null;

  const authUrl = httpsOrigin(process.env.FLEXEXA_CUSTOMER_AUTH_URL);
  const apiUrl = httpsOrigin(process.env.FLEXEXA_CUSTOMER_API_URL);
  const publishableKey = process.env.FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY;
  if (!authUrl || !apiUrl || !publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return null;

  return { authUrl, apiUrl, publishableKey, emailOtpEnabled: process.env.FLEXEXA_CUSTOMER_EMAIL_OTP_PREVIEW === "true" };
}
