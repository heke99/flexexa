import { NextResponse } from "next/server";
import { reportApplicationFailure, rpc, sendPendingEmails } from "@/domains/applications/server";

export const maxDuration = 120;
const headers = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Nekad åtkomst" }, { status: 401, headers });
  }

  try {
    await rpc("cleanup");
    const processed = await sendPendingEmails(5);
    console.info(JSON.stringify({ event: "applications.cron.completed", processed }));
    return NextResponse.json({ processed }, { headers });
  } catch (error) {
    const { failure, requestId } = reportApplicationFailure("cron", error);
    return NextResponse.json({ error: "Kön kräver nytt försök", requestId }, { status: failure.status, headers });
  }
}
