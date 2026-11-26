import "server-only";

import { inspectCustomerPreview } from "@/lib/customer-preview-settings";

export function customerAccountConfig() {
  const preview = inspectCustomerPreview(process.env);
  return preview.state === "enabled" ? preview.config : null;
}
