import { useRef } from "react";
import type { CustomerProductAccess, CustomerProductKey, RequestedProductKey } from "@/lib/customer-product-access";
import type { CustomerAccount } from "@/lib/customer-accounts";
import { customerPortalUrl } from "@/lib/customer-portal-entry";

const offers = [
  { key: "charging_subscription", name: "Laddabonnemang" },
  { key: "energy_optimization", name: "Energioptimering" },
] as const;

function accessLabel(access: CustomerProductAccess, key: CustomerProductKey) {
  const policy = access.items.find(item => item.product_key === key);
  if (policy?.enabled) return "Aktiv";
  if (policy?.status === "revoked") return "Indragen";
  if (policy?.status === "active") return "Ej tillgänglig";
  return access.requests.some(request => request.product_key === key) ? "Begärd" : "Ingen åtkomst";
}

export type ProductSelection = { accountId: string; accountName: string } & (
  | { status: "loading"; sending: boolean }
  | { status: "error"; message: string }
  | { status: "ready"; access: CustomerProductAccess }
);

export function CustomerProducts({ account, products, retry, requestAccess }: {
  account: CustomerAccount;
  products: ProductSelection;
  retry: () => void;
  requestAccess: (key: RequestedProductKey) => void;
}) {
  const title = useRef<HTMLHeadingElement>(null);
  return <section id="account-products" aria-labelledby="account-products-title" aria-busy={products.status === "loading"}>
    <h2 id="account-products-title" tabIndex={-1} ref={title}>Mina produkter</h2>
    <p>{products.accountName}</p>
    {products.status === "loading" && <p role="status">{products.sending ? "Skickar begäran …" : "Hämtar produkter …"}</p>}
    {products.status === "error" && <>
      <p role="status">{products.message}</p>
      <button type="button" className="button" onClick={() => { title.current?.focus(); retry(); }}>Försök igen</button>
    </>}
    {products.status === "ready" && <dl>
      {offers.map(offer => {
        const label = accessLabel(products.access, offer.key);
        const canRequest = label === "Ingen åtkomst" && account.role === "owner" &&
          (offer.key !== "energy_optimization" || account.kind === "business");
        return <div key={offer.key}>
          <dt><strong>{offer.name}</strong></dt>
          <dd>{label}{canRequest && <div><button type="button" className="button" onClick={() => {
            title.current?.focus();
            requestAccess(offer.key);
          }}>
            Begär åtkomst till {offer.name}
          </button></div>}</dd>
        </div>;
      })}
    </dl>}
    <p><a className="text-link" href={customerPortalUrl("produkter")}>Hantera produkter i kundportalen</a></p>
  </section>;
}
