import { readCustomerAccountApi } from "@/lib/customer-account-api";
import { customerVehicleListPath, normalizeCustomerVehicles } from "@/lib/customer-vehicles";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await context.params;
  const query = new URL(request.url).searchParams;
  return readCustomerAccountApi(request, customerVehicleListPath(accountId, query), normalizeCustomerVehicles);
}
