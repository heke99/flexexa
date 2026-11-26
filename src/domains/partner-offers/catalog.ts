import { approvedPublication, formatOfferAmount, readPublicOffers } from "./publication.ts";

export const catalogVersion = approvedPublication.version;
export const partnerCodes = ["gridex"] as const;
export type PartnerCode = typeof partnerCodes[number];

export function partnerCode(value: unknown): PartnerCode | null {
  return typeof value === "string" && partnerCodes.includes(value as PartnerCode) ? value as PartnerCode : null;
}

export function partnerLinks(code: unknown) {
  const partner = partnerCode(code);
  if (!partner) return null;
  const attributed = (path: string, origin: string) => {
    const url = new URL(path, origin);
    url.search = new URLSearchParams({ partner }).toString();
    return url.href;
  };
  return {
    landing: new URL(`/partner/${partner}`, "https://flexexa.com").href,
    energyWizard: attributed("/energy-wizard", "https://flexexa.com"),
    orders: attributed("/bestallningar", "https://ladda.flexexa.com"),
    standalone: attributed("/elbilsabonnemang/flexexa/orderoversikt", "https://ladda.flexexa.com"),
    gridex: attributed("/elbilsabonnemang/flexexa-gridex", "https://ladda.flexexa.com"),
  };
}

export function partnerCatalog(code: unknown, now = new Date()) {
  const partner = partnerCode(code);
  if (!partner) return null;
  const links = partnerLinks(partner)!;
  const release = readPublicOffers(now);
  if (!release) return null;
  const offer = {
    currency: release.currency,
    vat_included: release.vatIncluded,
    interval: release.interval,
    purchase_available: release.purchaseAvailable,
    availability_reason: release.availabilityReason,
    initial_binding_months: release.initialBindingMonths,
    notice_months: release.noticeMonths,
    renewal_months: release.renewalBindingMonths,
    renewal_binding_months: release.renewalBindingMonths,
    calendar_timezone: release.calendarTimezone,
    terms_version: release.termsVersion,
    terms_url: release.termsUrl,
  };
  return {
    version: release.version,
    partner_code: partner,
    integration_status: "public_handoff_only",
    customer_data_shared: false,
    attribution: "Public campaign source only; not verified identity, supply eligibility or a commission claim.",
    landing_url: links.landing,
    energy_wizard_url: links.energyWizard,
    offers: [
      { ...offer, id: "flexexa", name: "Flexexa", amount_minor: release.standardAmountMinor,
        price_condition: "Behåll ditt nuvarande elavtal.", url: links.standalone },
      { ...offer, id: "flexexa-gridex", name: "Flexexa med Gridex", amount_minor: release.gridexAmountMinor,
        price_condition: `Priset för Flexexa gäller endast under bekräftad rabattgrundande elleverans från Gridex. Ordinarie pris ${formatOfferAmount(release.standardAmountMinor)} kr/månad. Gridex elavtal och avgifter faktureras separat.`,
        url: links.gridex },
    ],
  };
}
