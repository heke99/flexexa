import { partnerCatalog, partnerCode } from "@/domains/partner-offers/catalog";

export async function GET(_request: Request, { params }: { params: Promise<{ partner: string }> }) {
  const partner = partnerCode((await params).partner);
  const headers = { "Access-Control-Allow-Origin": "*", "X-Content-Type-Options": "nosniff" };
  if (!partner) return Response.json({ error: "PARTNER_NOT_FOUND" }, {
    status: 404, headers: { ...headers, "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
  const catalog = partnerCatalog(partner);
  if (!catalog) return Response.json({ error: "OFFER_CATALOG_UNAVAILABLE" }, {
    status: 503, headers: { ...headers, "Cache-Control": "no-store" },
  });
  return Response.json(catalog, { headers: { ...headers, "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
