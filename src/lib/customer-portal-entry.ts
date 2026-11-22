const portalOrigin = "https://ladda.flexexa.com";
const destinations = {
  konto: "/",
  produkter: "/produkter",
} as const;

type PortalEntry = keyof typeof destinations;

export function customerPortalEntry(entry: PortalEntry) {
  return `/app/${entry}`;
}

export function redirectToCustomerPortal(entry: PortalEntry) {
  // The portal owns its existing Auth and payment returns. Forward only the
  // fixed destination without reading incoming parameters.
  return new Response(null, {
    status: 307,
    headers: {
      Location: new URL(destinations[entry], portalOrigin).href,
      "Cache-Control": "no-store",
    },
  });
}
