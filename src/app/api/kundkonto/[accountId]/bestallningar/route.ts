import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { isCustomerResourceId } from "@/lib/customer-accounts";
import { normalizeCustomerOrders } from "@/lib/customer-orders";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await context.params;
  const path = isCustomerResourceId(accountId) ? `/v1/accounts/${accountId}/orders?limit=10` as const : null;
  return readCustomerAccountApi(request, path, normalizeCustomerOrders);
}
