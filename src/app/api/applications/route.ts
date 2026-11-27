import {unstable_cache} from "next/cache";
import {after,NextResponse} from "next/server";
import {rpc,networkHash,sendPendingEmails,validOrigin,reportApplicationFailure,ApplicationError,settings} from "@/domains/applications/server";
import {validateApplication} from "@/domains/applications/validation";
import {JsonRequestError,readBoundedJson} from "@/lib/bounded-json-request";
export const maxDuration=120;
export const revalidate=0;
const applicationBodyLimit = 8192;
async function fetchPublicStats() {
 const {count,remaining}=await rpc("stats");
 if(typeof count!=="number"||!Number.isSafeInteger(count)||count<0||
    typeof remaining!=="number"||!Number.isSafeInteger(remaining)||remaining<0) {
  throw new ApplicationError("INVALID_STATS_RESPONSE",502);
 }
 return {count,remaining};
}

let pendingStats: ReturnType<typeof fetchPublicStats> | undefined;
function refreshPublicStats() {
 pendingStats ??= fetchPublicStats().finally(() => { pendingStats = undefined; });
 return pendingStats;
}

const publicStats = () => unstable_cache(
 refreshPublicStats, ["flexexa-application-totals", settings().url], { revalidate: 15 },
)();

export async function GET() {
 try {
  return NextResponse.json(await publicStats(), { headers: { "Cache-Control": "no-store" } });
 } catch (error) {
  const { failure, requestId, headers } = reportApplicationFailure("stats", error);
  return NextResponse.json({ error: "Antalet kan inte hämtas just nu.", requestId }, { status: failure.status, headers });
 }
}
export async function POST(request: Request) {
 const headers = { "Cache-Control": "no-store" };
 if (!validOrigin(request)) return NextResponse.json({ error: "Ogiltigt anrop." }, { status: 403, headers });
 if (Number(request.headers.get("content-length")) > applicationBodyLimit) {
  return NextResponse.json({ error: "För mycket data." }, { status: 413, headers });
 }
 let input: unknown;
 try {
  input = await readBoundedJson(request, applicationBodyLimit);
 } catch (error) {
  if (error instanceof JsonRequestError && error.status === 413) {
   return NextResponse.json({ error: "För mycket data." }, { status: 413, headers });
  }
  return NextResponse.json({ error: "Kontrollera formuläret." }, { status: 400, headers });
 }
 let data;
 try {
  data = validateApplication(input);
 } catch (error) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Kontrollera formuläret." }, { status: 400, headers });
 }
 try {
  const result = await rpc<unknown>("submit", {
   ...data,
   is_test: process.env.VERCEL_ENV === "preview" && data.email === process.env.FLEXEXA_APPLICATION_TEST_EMAIL,
   network_hash: networkHash(request),
  });
  if (!result || typeof result !== "object" || Array.isArray(result)) {
   throw new ApplicationError("INVALID_APPLICATION_RECEIPT", 502);
  }
  if ("limited" in result && result.limited === true && !("ok" in result) && !("created" in result)) {
   return NextResponse.json({ error: "För många försök. Försök igen senare." }, { status: 429, headers });
  }
  if ("limited" in result || !("ok" in result) || result.ok !== true ||
      !("created" in result) || typeof result.created !== "boolean") {
   throw new ApplicationError("INVALID_APPLICATION_RECEIPT", 502);
  }
  after(async () => {
   try { await sendPendingEmails(); }
   catch (error) { reportApplicationFailure("application_email_queue", error); }
  });
  return NextResponse.json({ ok: true, message: "Tack! Om mejladressen inte redan är registrerad har din ansökan sparats. Bekräftelsen skickas till din mejladress. Kontrollera även skräpposten." });
 } catch (error) {
  const { failure, requestId, headers } = reportApplicationFailure("submit", error);
  return NextResponse.json({ error: "Ansökan kunde inte sparas. Försök igen om en stund.", requestId }, { status: failure.status, headers });
 }
}
