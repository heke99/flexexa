import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { customerAccountConfig } from "@/lib/customer-account-config";
import { customerPortalUrl } from "@/lib/customer-portal-entry";
import { CustomerAccounts } from "./customer-accounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mitt konto", robots: { index: false, follow: false } };

export default function AccountOverviewPage() {
  const config = customerAccountConfig();
  const portal = customerPortalUrl("konto");
  if (!config) redirect(portal);

  return <main id="main" className="wrap section">
    <h1>Mitt konto</h1>
    <CustomerAccounts authUrl={config.authUrl} publishableKey={config.publishableKey}
      emailOtpEnabled={config.emailOtpEnabled} />
    <p><a className="text-link" href={portal}>Öppna kundportalen</a> för abonnemang, beställningar och kontoinställningar.</p>
  </main>;
}
