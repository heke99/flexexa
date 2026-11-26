import { createHash } from "node:crypto";
import release from "./releases/flexexa-partner-offers-2026-11-13-v2.json" with { type: "json" };

type OfferRelease = typeof release;
type Publication = { version: string; sha256: string };

// Publishing a new price requires selecting a new approved snapshot. Existing
// release artifacts and Commerce terms stay available at their original paths.
export const approvedPublication = {
  version: "flexexa-partner-offers-2026-11-13-v2",
  sha256: "72d7bc661d885c2126fd3e039537a6256bb01ceaa08f4cefee76eaec79836afb",
} as const;

const stockholmsDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm", year: "numeric", month: "2-digit", day: "2-digit",
});
const positiveInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validatePublicOfferRelease(value: unknown, publication: Publication, now: Date): OfferRelease | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Number.isFinite(+now)) return null;
  const candidate = value as Partial<OfferRelease>;
  const { version, effectiveFrom, commerceRevision, termsVersion, standardAmountMinor, gridexDiscountMinor,
    initialBindingMonths, renewalBindingMonths, noticeMonths, availabilityReason } = candidate;
  if (version !== publication.version || !/^flexexa-partner-offers-\d{4}-\d{2}-\d{2}-v[1-9]\d*$/.test(version)
    || !date(effectiveFrom) || effectiveFrom > stockholmsDate.format(now)
    || typeof commerceRevision !== "string" || !/^[a-f0-9]{40}$/.test(commerceRevision)
    || typeof termsVersion !== "string" || !/^privat-\d{4}-\d{2}-\d{2}-v[1-9]\d*$/.test(termsVersion)
    || !positiveInteger(standardAmountMinor) || !positiveInteger(gridexDiscountMinor) || gridexDiscountMinor >= standardAmountMinor
    || !positiveInteger(initialBindingMonths) || !Number.isSafeInteger(standardAmountMinor * initialBindingMonths)
    || !positiveInteger(renewalBindingMonths) || !positiveInteger(noticeMonths)
    || candidate.calendarTimezone !== "Europe/Stockholm"
    || candidate.currency !== "SEK" || candidate.interval !== "month" || candidate.vatIncluded !== true
    || candidate.gridexDiscountCondition !== "confirmed_active_qualifying_supply" || candidate.purchaseAvailable !== false
    || typeof availabilityReason !== "string" || !availabilityReason.trim()) return null;
  try {
    if (createHash("sha256").update(JSON.stringify(value)).digest("hex") !== publication.sha256) return null;
  } catch {
    return null;
  }
  return candidate as OfferRelease;
}

export function readPublicOffers(now = new Date()) {
  const approved = validatePublicOfferRelease(release, approvedPublication, now);
  if (!approved) return null;
  return {
    ...approved,
    gridexAmountMinor: approved.standardAmountMinor - approved.gridexDiscountMinor,
    initialMinimumMinor: approved.standardAmountMinor * approved.initialBindingMonths,
    termsUrl: new URL(`/terms/${approved.termsVersion}.pdf`, "https://ladda.flexexa.com").href,
  };
}

const amountFormatter = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 2 });
export const formatOfferAmount = (minor: number) => amountFormatter.format(minor / 100).replaceAll("\u00a0", " ");
