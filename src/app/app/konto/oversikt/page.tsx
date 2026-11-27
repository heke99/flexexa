import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { customerAccountConfig } from "@/lib/customer-account-config";
import { customerPortalUrl } from "@/lib/customer-portal-entry";
import { CustomerAccounts } from "./customer-accounts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mitt konto", robots: { index: false, follow: false } };

export default async function AccountOverviewPage({ searchParams }: { searchParams: Promise<{ inloggning?: string | string[] }> }) {
  const config = customerAccountConfig();
  const portal = customerPortalUrl("konto");
  if (!config) redirect(portal);
  const { inloggning } = await searchParams;

  return <main id="main" className="wrap section">
    <h1>Mitt konto</h1>
    <CustomerAccounts authUrl={config.authUrl} publishableKey={config.publishableKey}
      emailOtpEnabled={config.emailOtpEnabled} startEmailCode={inloggning === "epostkod"} />
    <p><a className="text-link" href={portal}>Öppna kundportalen</a> för abonnemang, beställningar och kontoinställningar.</p>
  </main>;
}
