import {NextResponse} from "next/server";
import {sendPendingEmails,rpc,reportApplicationFailure} from "@/domains/applications/server";
export const maxDuration=120;
export async function GET(request:Request){if(!process.env.CRON_SECRET||request.headers.get("authorization")!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:"Nekad åtkomst"},{status:401});try{await rpc("cleanup");return NextResponse.json({processed:await sendPendingEmails(5)});}catch(error){const {failure,requestId}=reportApplicationFailure("cron",error);return NextResponse.json({error:"Kön kräver nytt försök",requestId},{status:failure.status,headers:{"Cache-Control":"no-store"}});}}
