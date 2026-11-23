import { isCustomerResourceId } from "./customer-accounts";

const portalOrigin = "https://ladda.flexexa.com";
const destinations = {
  konto: "/",
  produkter: "/produkter",
  bestallningar: "/bestallningar",
  foretagsbestallningar: "/foretag/order",
  laddhistorik: "/historik",
} as const;

type PortalEntry = keyof typeof destinations;

export function customerPortalEntry(entry: PortalEntry) {
  return `/app/${entry}`;
}

export function customerPortalUrl(entry: PortalEntry) {
  return new URL(destinations[entry], portalOrigin).href;
}

export function customerPortalOrderUrl(orderId: string) {
  if (!isCustomerResourceId(orderId)) return null;
  const url = new URL(customerPortalUrl("bestallningar"));
  url.searchParams.set("order", orderId.toLowerCase());
  return url.href;
}

export function redirectToCustomerPortal(entry: PortalEntry) {
  // The portal owns its existing Auth and payment returns. Forward only the
  // fixed destination without reading incoming parameters.
  return new Response(null, {
    status: 307,
    headers: {
      Location: customerPortalUrl(entry),
      "Cache-Control": "no-store",
    },
  });
}
