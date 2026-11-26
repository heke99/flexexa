import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseAdminApplicationPage } from "@/domains/applications/admin-page";
import { decodeApplicationCursor } from "@/domains/applications/cursor";
import { adminRpc, ApplicationError, reportApplicationFailure } from "@/domains/applications/server";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function GET(request: Request) {
  const token = (await cookies()).get("flexexa_admin")?.value;
  if (!token) return NextResponse.json({ error: "Logga in som superadmin." }, { status: 401, headers: privateHeaders });

  const params = new URL(request.url).searchParams;
  const page = Number(params.get("page") ?? 0);
  const cursor = params.get("cursor");
  const after = cursor === null ? null : decodeApplicationCursor(cursor);
  if (!Number.isInteger(page) || page < 0 || page > 100 ||
    (cursor !== null && (!after || params.has("page") || params.getAll("cursor").length !== 1))) {
    return NextResponse.json({ error: "Ogiltig sida." }, { status: 400, headers: privateHeaders });
  }

  try {
    const result = parseAdminApplicationPage(await adminRpc<unknown>("admin_list", token, after ? { after } : { page }));
    if (!result) throw new ApplicationError("INVALID_ADMIN_PAGE", 502);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    const { failure, requestId, headers } = reportApplicationFailure("admin_list", error);
    for (const [name, value] of Object.entries(privateHeaders)) headers.set(name, value);
    const status = failure.status;
    const message = status === 401 || status === 403
      ? "Behörighet saknas eller sessionen har gått ut."
      : "Listan kunde inte hämtas.";
    return NextResponse.json({ error: message, requestId }, { status, headers });
  }
}
