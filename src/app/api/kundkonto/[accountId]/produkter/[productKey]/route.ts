import { requestCustomerProduct } from "@/lib/customer-account-api";
import { isRequestedProduct, productAccessPath } from "@/lib/customer-product-access";

export async function POST(request: Request, context: { params: Promise<{ accountId: string; productKey: string }> }) {
  const { accountId, productKey } = await context.params;
  return requestCustomerProduct(request, productAccessPath(accountId), isRequestedProduct(productKey) ? productKey : null);
}
