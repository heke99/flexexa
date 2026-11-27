import type { CustomerOrders } from "@/lib/customer-orders";
import { customerPortalOrderUrl, customerPortalUrl } from "@/lib/customer-portal-entry";

const states = {
  pending: "Väntar på betalning",
  paid: "Betald",
  blocked: "Spärrad",
  refunded: "Återbetald",
} as const;
const date = new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium", timeZone: "Europe/Stockholm" });
const kronor = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });

function amount(amountMinor: number) {
  const minor = BigInt(amountMinor);
  return `${kronor.format(minor / 100n)},${String(minor % 100n).padStart(2, "0")} kr`;
}

export type OrderSelection = { accountId: string; accountName: string } & (
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; orders: CustomerOrders }
);

export function CustomerOrdersPanel({ selection, business, refresh }: {
  selection: OrderSelection; business: boolean; refresh: () => void;
}) {
  return <section id="account-orders" aria-labelledby="account-orders-title" aria-busy={selection.status === "loading"}>
    <h2 id="account-orders-title">Beställningar</h2>
    <p>{selection.accountName}</p>
    {selection.status === "loading" && <p role="status">Hämtar beställningar …</p>}
    {selection.status === "error" && <p role="status">{selection.message}</p>}
    {selection.status === "ready" && (selection.orders.items.length === 0 ? <p>Det finns inga beställningar på kontot.</p> : <>
      <p>De tio senaste beställningarna.</p>
      <ul>{selection.orders.items.map(order => {
        const reference = `order-reference-${order.id}`;
        const continuation = !business && order.state === "pending" ? customerPortalOrderUrl(order.id) : null;
        return <li key={order.id}>
          <strong>{states[order.state]}</strong> · <time dateTime={order.createdAt}>{date.format(new Date(order.createdAt))}</time>
          {order.amountMinor !== null && order.currency === "SEK" && <> · {amount(order.amountMinor)}</>}
          <br /><small id={reference}>Referens {order.id}</small>
          {continuation && <p><a className="text-link" href={continuation} referrerPolicy="no-referrer" aria-describedby={reference}>
            Öppna beställningen i kundportalen
          </a></p>}
        </li>;
      })}</ul>
    </>)}
    <button type="button" className="button" aria-disabled={selection.status === "loading"}
      onClick={() => { if (selection.status !== "loading") refresh(); }}>
      {selection.status === "error" ? "Försök igen" : "Uppdatera beställningar"}
    </button>
    <p><a className="text-link" href={customerPortalUrl(business ? "foretagsbestallningar" : "bestallningar")}>
      Hantera beställningar i kundportalen
    </a></p>
  </section>;
}
