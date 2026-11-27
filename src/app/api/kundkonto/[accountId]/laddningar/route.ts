import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { isCustomerResourceId } from "@/lib/customer-accounts";
import { normalizeCustomerSessions } from "@/lib/customer-sessions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await context.params;
  const path = isCustomerResourceId(accountId) && !new URL(request.url).search
    ? `/v1/accounts/${accountId}/sessions?limit=10` as const : null;
  return readCustomerAccountApi(request, path, normalizeCustomerSessions);
}
