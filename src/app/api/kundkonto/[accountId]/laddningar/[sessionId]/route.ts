import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { isCustomerResourceId } from "@/lib/customer-accounts";
import { normalizeCustomerSession } from "@/lib/customer-sessions";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ accountId: string; sessionId: string }> }) {
  const { accountId, sessionId } = await context.params;
  const path = isCustomerResourceId(accountId) && isCustomerResourceId(sessionId) && !new URL(request.url).search
    ? `/v1/accounts/${accountId}/sessions/${sessionId}` as const : null;
  return readCustomerAccountApi(request, path, payload => {
    const session = normalizeCustomerSession(payload);
    return session?.id === sessionId.toLowerCase() ? session : null;
  });
}
