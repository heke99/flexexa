import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {settings,rpc,validOrigin} from "@/domains/applications/server";
export const maxDuration=60;
export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Nekad åtkomst"},{status:403});
 try{
  const body=await request.json(),c=settings();
  if(body.token_hash){
   if(typeof body.token_hash!=="string"||!/^[a-f0-9]{40,128}$/i.test(body.token_hash))throw Error();
   const verified=await fetch(c.url+"/auth/v1/verify",{method:"POST",headers:{apikey:c.key,"Content-Type":"application/json"},body:JSON.stringify({token_hash:body.token_hash,type:"email"}),cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!verified.ok)throw Error();
   const session=await verified.json();
   if(typeof session.access_token!=="string")throw Error();
   await rpc("owner_login",{},session.access_token);await rpc("admin_list",{page:0},session.access_token);
   const response=NextResponse.json({ok:true});response.cookies.set("flexexa_admin",session.access_token,{httpOnly:true,secure:true,sameSite:"strict",path:"/api/admin",maxAge:Math.min(session.expires_in||3600,3600)});return response;
  }
  const email=String(body.email||"").trim().toLowerCase();
  if(email!=="hekmat.h@div3rsa.com")return NextResponse.json({message:"Om adressen är behörig skickas en inloggningslänk."});
  const generated=await fetch(c.url+"/functions/v1/flexexa-owner-auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:c.secret}),cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(!generated.ok)return NextResponse.json({error:generated.status===429?"För många inloggningsförsök. Försök igen senare.":"Inloggningsmejlet kunde inte skickas. Försök igen senare."},{status:generated.status===429?429:503});
  const data=await generated.json();if(typeof data.token_hash!=="string")throw Error();
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,"Content-Type":"application/json","Idempotency-Key":`flexexa-owner-${randomUUID()}`},body:JSON.stringify({from:"Flexexa via Trafexa Nordic <info@trafexa.com>",to:[email],reply_to:"info@flexexa.com",subject:"Logga in som superadmin på Flexexa",text:`Öppna länken och välj Bekräfta inloggning:\n\nhttps://www.flexexa.com/admin/ansokningar#token_hash=${encodeURIComponent(data.token_hash)}\n\nLänken är personlig, gäller en gång och slutar gälla efter en timme. Dela den inte. Begär en ny länk om den har gått ut.\n\nFlexexa / Trafexa Nordic AB`}),signal:AbortSignal.timeout(15000)});
  if(!sent.ok)return NextResponse.json({error:"Inloggningsmejlet kunde inte skickas. Försök igen senare."},{status:503});
  return NextResponse.json({message:"En inloggningslänk har skickats. Kontrollera även skräpposten."});
 }catch{return NextResponse.json({error:"Inloggningen kunde inte verifieras. Begär en ny länk."},{status:401});}
}
export async function DELETE(request:Request){if(!validOrigin(request))return NextResponse.json({error:"Nekad åtkomst"},{status:403});const response=NextResponse.json({ok:true});response.cookies.set("flexexa_admin","",{httpOnly:true,secure:true,sameSite:"strict",path:"/api/admin",maxAge:0});return response;}
