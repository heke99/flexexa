import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { accountRoleLabels, type CustomerAccount } from "@/lib/customer-accounts";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return readCustomerAccountApi(request, "/v1/accounts", payload => {
    if (!payload || typeof payload !== "object" || !("items" in payload) || !Array.isArray(payload.items)) return null;
    const items: CustomerAccount[] = [];
    for (const account of payload.items) {
      if (!account || typeof account.id !== "string" || typeof account.name !== "string" ||
        !["personal", "business"].includes(account.kind) || !Object.hasOwn(accountRoleLabels, account.role)) {
        return null;
      }
      items.push({ id: account.id, name: account.name, kind: account.kind, role: account.role });
    }
    return { items };
  });
}
