import "server-only";

import { httpsOrigin } from "./https-origin";

export function customerAccountConfig() {
  if (process.env.FLEXEXA_CUSTOMER_ACCOUNT_PREVIEW !== "true") return null;

  const authUrl = httpsOrigin(process.env.FLEXEXA_CUSTOMER_AUTH_URL);
  const apiUrl = httpsOrigin(process.env.FLEXEXA_CUSTOMER_API_URL);
  const publishableKey = process.env.FLEXEXA_CUSTOMER_AUTH_PUBLISHABLE_KEY;
  if (!authUrl || !apiUrl || !publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) return null;

  return { authUrl, apiUrl, publishableKey };
}
