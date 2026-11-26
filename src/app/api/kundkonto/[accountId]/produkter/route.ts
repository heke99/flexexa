import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { normalizeProductAccess, productAccessPath } from "@/lib/customer-product-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await context.params;
  return readCustomerAccountApi(request, productAccessPath(accountId), normalizeProductAccess);
}
