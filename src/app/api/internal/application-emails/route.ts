import {NextResponse} from "next/server";
import {sendPendingEmails,rpc} from "@/domains/applications/server";
export const maxDuration=120;
export async function GET(request:Request){if(!process.env.CRON_SECRET||request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Nekad åtkomst"},{status:401});try{await rpc("cleanup");return NextResponse.json({processed:await sendPendingEmails(5)});}catch{return NextResponse.json({error:"Kön kräver nytt försök"},{status:503});}}
