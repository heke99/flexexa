import {after,NextResponse} from "next/server";
import {rpc,networkHash,sendPendingEmails,validOrigin} from "@/domains/applications/server";
import {validateApplication} from "@/domains/applications/validation";
export const maxDuration=120;
export const dynamic="force-dynamic";
export async function GET(){try{return NextResponse.json(await rpc("stats"),{headers:{"Cache-Control":"no-store"}});}catch{return NextResponse.json({error:"Antalet kan inte hämtas just nu."},{status:503});}}
export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Ogiltigt anrop."},{status:403});
 if(Number(request.headers.get("content-length")||0)>8192)return NextResponse.json({error:"För mycket data."},{status:413});
 let data;try{const raw=await request.text();if(raw.length>8192)throw Error("För mycket data.");const parsed=JSON.parse(raw);data=validateApplication(parsed);}catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Kontrollera formuläret."},{status:400});}
 try{const result=await rpc("submit",{...data,is_test:data.email==="delivered@resend.dev",network_hash:networkHash(request.headers.get("x-vercel-forwarded-for")||request.headers.get("x-forwarded-for")||"unknown")});if(result.limited)return NextResponse.json({error:"För många försök. Försök igen senare."},{status:429});after(async()=>{try{await sendPendingEmails();}catch{console.error("APPLICATION_EMAIL_QUEUE_PENDING");}});return NextResponse.json({ok:true,message:"Tack! Om mejladressen inte redan är registrerad har din ansökan sparats. Bekräftelsen skickas till din mejladress. Kontrollera även skräpposten."});}catch{return NextResponse.json({error:"Ansökan kunde inte sparas. Försök igen om en stund."},{status:503});}
}
