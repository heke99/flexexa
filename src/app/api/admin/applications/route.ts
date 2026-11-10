import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {rpc} from "@/domains/applications/server";
export const dynamic="force-dynamic";
export async function GET(request:Request){const token=(await cookies()).get("flexexa_admin")?.value;if(!token)return NextResponse.json({error:"Logga in som superadmin."},{status:401});const page=Number(new URL(request.url).searchParams.get("page")||0);if(!Number.isInteger(page)||page<0||page>100000)return NextResponse.json({error:"Ogiltig sida"},{status:400});try{return NextResponse.json(await rpc("admin_list",{page},token),{headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});}catch{return NextResponse.json({error:"Behörighet saknas eller sessionen har gått ut."},{status:403});}}
