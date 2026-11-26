import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {settings,adminRpc,validOrigin,ApplicationError,reportApplicationFailure} from "@/domains/applications/server";
export const maxDuration=60;
export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Nekad åtkomst"},{status:403});
 try{
  const body=await request.json(),c=settings();
  if(body.token_hash||body.password){
   if(!body.password&&typeof body.token_hash!=="string"||(!body.password&&!/^[a-f0-9]{40,128}$/i.test(body.token_hash)))throw new ApplicationError("INVALID_LOGIN_INPUT",400);
   const verified=await fetch(c.url+(body.password?"/auth/v1/token?grant_type=password":"/auth/v1/verify"),{method:"POST",headers:{apikey:c.key,"Content-Type":"application/json"},body:JSON.stringify(body.password?{email:String(body.email||"").trim().toLowerCase(),password:body.password}:{token_hash:body.token_hash,type:"email"}),cache:"no-store",signal:AbortSignal.timeout(15000)});
   if(!verified.ok)throw new ApplicationError(verified.status>=500?"AUTH_UNAVAILABLE":"UNAUTHENTICATED",verified.status>=500?503:verified.status===429?429:401);
   const session=await verified.json();
   if(typeof session.access_token!=="string")throw new ApplicationError("INVALID_AUTH_RESPONSE",502);
   await adminRpc("owner_login",session.access_token);await adminRpc("admin_list",session.access_token,{page:0});
   const response=NextResponse.json({ok:true});response.cookies.set("flexexa_admin",session.access_token,{httpOnly:true,secure:true,sameSite:"strict",path:"/api/admin",maxAge:Math.min(session.expires_in||3600,3600)});return response;
  }
  const email=String(body.email||"").trim().toLowerCase();
  const configuredEmail=process.env.FLEXEXA_ADMIN_EMAIL?.trim().toLowerCase();
  if(!configuredEmail)throw new ApplicationError("ADMIN_EMAIL_NOT_CONFIGURED",503);
  if(email!==configuredEmail)return NextResponse.json({message:"Om adressen är behörig skickas en inloggningslänk."});
  const mailKey=process.env.RESEND_API_KEY;
  const configuredOrigin=process.env.FLEXEXA_ADMIN_ORIGIN;
  if(!mailKey || !configuredOrigin)throw new ApplicationError("ADMIN_EMAIL_NOT_CONFIGURED",503);
  const returnUrl=new URL(configuredOrigin);
  if(returnUrl.protocol!=="https:"||returnUrl.username||returnUrl.password||returnUrl.origin!==configuredOrigin||new URL(request.url).origin!==returnUrl.origin)
   throw new ApplicationError("INVALID_ADMIN_ORIGIN",503);
  returnUrl.pathname="/admin";
  const generated=await fetch(c.url+"/functions/v1/flexexa-owner-auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:c.secret,email}),cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(!generated.ok)return NextResponse.json({error:generated.status===429?"För många inloggningsförsök. Försök igen senare.":"Inloggningsmejlet kunde inte skickas. Försök igen senare."},{status:generated.status===429?429:503});
  const data=await generated.json();if(typeof data.token_hash!=="string"||data.email!==email)throw new ApplicationError("INVALID_AUTH_RESPONSE",502);
  returnUrl.hash=new URLSearchParams({token_hash:data.token_hash}).toString();
  const sent=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${mailKey}`,"Content-Type":"application/json","Idempotency-Key":`flexexa-owner-${randomUUID()}`},body:JSON.stringify({from:"Flexexa via Trafexa Nordic <info@trafexa.com>",to:[email],reply_to:"info@flexexa.com",subject:"Logga in som superadmin på Flexexa",text:`Öppna länken och välj Bekräfta inloggning:\n\n${returnUrl.href}\n\nLänken är personlig, gäller en gång och slutar gälla efter en timme. Dela den inte. Begär en ny länk om den har gått ut.\n\nFlexexa / Trafexa Nordic AB`}),signal:AbortSignal.timeout(15000)});
  if(!sent.ok)throw new ApplicationError(sent.status===429?"RATE_LIMITED":"EMAIL_PROVIDER_ERROR",sent.status===429?429:503);
  return NextResponse.json({message:"En inloggningslänk har skickats. Kontrollera även skräpposten."});
 }catch(error){
  const safe=error instanceof ApplicationError?error:new ApplicationError("ADMIN_LOGIN_FAILED",503);
  const {requestId}=reportApplicationFailure("admin_login",safe);
  return NextResponse.json({error:safe.status<500?"Inloggningen kunde inte verifieras. Begär en ny länk.":"Inloggningstjänsten är tillfälligt otillgänglig.",requestId},{status:safe.status,headers:{"Cache-Control":"no-store"}});
 }
}
export async function DELETE(request:Request){if(!validOrigin(request))return NextResponse.json({error:"Nekad åtkomst"},{status:403});const response=NextResponse.json({ok:true});response.cookies.set("flexexa_admin","",{httpOnly:true,secure:true,sameSite:"strict",path:"/api/admin",maxAge:0});return response;}

export async function PATCH(request:Request){if(!validOrigin(request))return NextResponse.json({error:"Nekad åtkomst"},{status:403});try{const token=(await cookies()).get("flexexa_admin")?.value;if(!token)throw Error();await adminRpc("admin_list",token,{page:0});const b=await request.json();if(typeof b.password!=="string"||b.password.length<12||b.password.length>128)return NextResponse.json({error:"Använd 12–128 tecken."},{status:400});const c=settings();const r=await fetch(c.url+"/auth/v1/user",{method:"PUT",headers:{apikey:c.key,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({password:b.password}),signal:AbortSignal.timeout(15000)});if(!r.ok)return NextResponse.json({error:"Lösenordet kunde inte sparas. Logga in med en ny länk och försök igen."},{status:400});return NextResponse.json({message:"Lösenordet är sparat."});}catch{return NextResponse.json({error:"Logga in på nytt."},{status:401});}}
