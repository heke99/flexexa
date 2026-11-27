import type { Metadata } from "next";
import Link from "next/link";
import { customerAccountConfig } from "@/lib/customer-account-config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hjälp med inloggning", robots: { index: false, follow: false } };

export default function CustomerLoginHelp() {
  const config = customerAccountConfig();

  return <main id="main" className="wrap section">
    <h1>Hjälp med inloggning</h1>
    <section>
      <h2>Glömt lösenordet?</h2>
      {config?.emailOtpEnabled ? <>
        <p>Du kan logga in på ditt befintliga konto med en kod till din bekräftade e-postadress. Om kontot använder tvåstegsverifiering behöver du också din kodapp.</p>
        <p><Link className="button primary" href="/app/konto/oversikt?inloggning=epostkod" prefetch={false}>Logga in med e-postkod</Link></p>
      </> : <p>E-postkod är inte tillgänglig här. Kontakta support om du inte kan logga in.</p>}
    </section>
    <section>
      <h2>Saknar du din kodapp eller tillgång till din e-post?</h2>
      <p>Kontakta support för hjälp. Dela aldrig lösenord eller engångskoder.</p>
      <p><Link className="text-link" href="/kontakt" prefetch={false}>Kontaktuppgifter</Link></p>
    </section>
    {config && <p><Link className="text-link" href="/app/konto/oversikt" prefetch={false}>Tillbaka till inloggningen</Link></p>}
  </main>;
}
