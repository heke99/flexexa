import { redirectToCustomerPortal } from "@/lib/customer-portal-entry";
import { customerAccountConfig } from "@/lib/customer-account-config";

export const dynamic = "force-dynamic";

export function GET() {
  if (customerAccountConfig()) {
    return new Response(null, {
      status: 307,
      headers: { Location: "/app/konto/oversikt", "Cache-Control": "no-store" },
    });
  }
  return redirectToCustomerPortal("konto");
}
