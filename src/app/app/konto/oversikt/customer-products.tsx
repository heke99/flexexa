import type { CustomerProductAccess, CustomerProductKey } from "@/lib/customer-product-access";
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
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; access: CustomerProductAccess }
);

export function CustomerProducts({ products, retry }: { products: ProductSelection; retry: () => void }) {
  return <section id="account-products" aria-labelledby="account-products-title">
    <h2 id="account-products-title">Mina produkter</h2>
    <p>{products.accountName}</p>
    {products.status === "loading" && <p role="status">Hämtar produkter …</p>}
    {products.status === "error" && <>
      <p role="status">{products.message}</p>
      <button type="button" className="button" onClick={retry}>Försök igen</button>
    </>}
    {products.status === "ready" && <dl>
      {offers.map(offer => <div key={offer.key}>
        <dt><strong>{offer.name}</strong></dt>
        <dd>{accessLabel(products.access, offer.key)}</dd>
      </div>)}
    </dl>}
    <p><a className="text-link" href={customerPortalUrl("produkter")}>Hantera produkter i kundportalen</a></p>
  </section>;
}
