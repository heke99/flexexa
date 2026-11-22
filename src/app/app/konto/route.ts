import { redirectToCustomerPortal } from "@/lib/customer-portal-entry";

export function GET() {
  return redirectToCustomerPortal("konto");
}
