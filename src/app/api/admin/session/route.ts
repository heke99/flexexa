import {cookies} from "next/headers";
import {NextResponse} from "next/server";
import {randomUUID} from "node:crypto";
import {settings,adminRpc,validOrigin,ApplicationError,reportApplicationFailure,limitedApplicationResponse} from "@/domains/applications/server";
export const maxDuration=60;

async function requestAdminDependency(url: string, init: RequestInit, dependency: "AUTH" | "OWNER_LINK" | "EMAIL_PROVIDER") {
 try {
  return await fetch(url, { ...init, redirect: "error" });
 } catch (error) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
   throw new ApplicationError(`${dependency}_TIMEOUT`, 504);
  }
  throw new ApplicationError(`${dependency}_UNAVAILABLE`, 503);
 }
}

export async function POST(request:Request){
 if(!validOrigin(request))return NextResponse.json({error:"Nekad åtkomst"},{status:403});
 try{
  const body=await request.json(),c=settings();
  if(body.token_hash||body.password){
   if(!body.password&&typeof body.token_hash!=="string"||(!body.password&&!/^[a-f0-9]{40,128}$/i.test(body.token_hash)))throw new ApplicationError("INVALID_LOGIN_INPUT",400);
   const verified=await requestAdminDependency(c.url+(body.password?"/auth/v1/token?grant_type=password":"/auth/v1/verify"),{method:"POST",headers:{apikey:c.key,"Content-Type":"application/json"},body:JSON.stringify(body.password?{email:String(body.email||"").trim().toLowerCase(),password:body.password}:{token_hash:body.token_hash,type:"email"}),cache:"no-store",signal:AbortSignal.timeout(15000)}, "AUTH");
   if(verified.status===429)throw limitedApplicationResponse(verified);
   if(!verified.ok)throw new ApplicationError(verified.status>=500?"AUTH_UNAVAILABLE":"UNAUTHENTICATED",verified.status>=500?503:401);
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
  const generated=await requestAdminDependency(c.url+"/functions/v1/flexexa-owner-auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:c.secret,email}),cache:"no-store",signal:AbortSignal.timeout(20000)}, "OWNER_LINK");
  if(generated.status===429)throw limitedApplicationResponse(generated);
  if(!generated.ok)throw new ApplicationError("OWNER_LINK_UNAVAILABLE",503);
  const data=await generated.json();if(typeof data.token_hash!=="string"||data.email!==email)throw new ApplicationError("INVALID_AUTH_RESPONSE",502);
  returnUrl.hash=new URLSearchParams({token_hash:data.token_hash}).toString();
  const sent=await requestAdminDependency("https://api.resend.com/emails",{method:"POST",headers:{Authorization:`Bearer ${mailKey}`,"Content-Type":"application/json","Idempotency-Key":`flexexa-owner-${randomUUID()}`},body:JSON.stringify({from:"Flexexa via Trafexa Nordic <info@trafexa.com>",to:[email],reply_to:"info@flexexa.com",subject:"Logga in som superadmin på Flexexa",text:`Öppna länken och välj Bekräfta inloggning:\n\n${returnUrl.href}\n\nLänken är personlig, gäller en gång och slutar gälla efter en timme. Dela den inte. Begär en ny länk om den har gått ut.\n\nFlexexa / Trafexa Nordic AB`}),signal:AbortSignal.timeout(15000)}, "EMAIL_PROVIDER");
  if(sent.status===429)throw limitedApplicationResponse(sent);
  if(!sent.ok)throw new ApplicationError("EMAIL_PROVIDER_ERROR",503);
  return NextResponse.json({message:"En inloggningslänk har skickats. Kontrollera även skräpposten."});
 }catch(error){
  const safe=error instanceof ApplicationError?error:new ApplicationError("ADMIN_LOGIN_FAILED",503);
  const {requestId,headers}=reportApplicationFailure("admin_login",safe);
  const message = safe.status === 429 ? "För många inloggningsförsök. Försök igen senare."
   : safe.status < 500 ? "Inloggningen kunde inte verifieras. Begär en ny länk."
   : "Inloggningstjänsten är tillfälligt otillgänglig.";
  return NextResponse.json({error:message,requestId},{status:safe.status,headers});
 }
}
export async function DELETE(request:Request){if(!validOrigin(request))return NextResponse.json({error:"Nekad åtkomst"},{status:403});const response=NextResponse.json({ok:true});response.cookies.set("flexexa_admin","",{httpOnly:true,secure:true,sameSite:"strict",path:"/api/admin",maxAge:0});return response;}

export async function PATCH(request: Request) {
 const headers = { "Cache-Control": "private, no-store" };
 if (!validOrigin(request)) return NextResponse.json({error:"Nekad åtkomst"},{status:403,headers});
 const token = (await cookies()).get("flexexa_admin")?.value;
 if (!token) return NextResponse.json({error:"Logga in på nytt."},{status:401,headers});
 try {
  await adminRpc("admin_list", token, {page:0});
  const body = await request.json().catch(() => null);
  const password: unknown = body?.password;
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
   return NextResponse.json({error:"Använd 12–128 tecken."},{status:400,headers});
  }
  const {url,key} = settings();
  const response = await requestAdminDependency(url + "/auth/v1/user", {
   method:"PUT", headers:{apikey:key,Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
   body:JSON.stringify({password}), cache:"no-store", signal:AbortSignal.timeout(15_000),
  }, "AUTH");
  if (response.status === 429) throw limitedApplicationResponse(response);
  if (response.status === 401) throw new ApplicationError("UNAUTHENTICATED",401);
  if (response.status === 403) throw new ApplicationError("ACCESS_DENIED",403);
  if (response.status === 400 || response.status === 422) {
   return NextResponse.json({error:"Lösenordet kunde inte sparas. Logga in med en ny länk och försök igen."},
    {status:400,headers});
  }
  if (!response.ok) throw new ApplicationError("AUTH_UNAVAILABLE",503);
  return NextResponse.json({message:"Lösenordet är sparat."},{headers});
 } catch (error) {
  if (error instanceof ApplicationError && error.status === 401) {
   return NextResponse.json({error:"Logga in på nytt."},{status:401,headers});
  }
  if (error instanceof ApplicationError && error.status === 403) {
   return NextResponse.json({error:"Nekad åtkomst"},{status:403,headers});
  }
  const {failure,requestId,headers: failureHeaders} = reportApplicationFailure("admin_password_change",error);
  const message = failure.status === 429 ? "För många försök. Försök igen senare." : "Lösenordstjänsten är tillfälligt otillgänglig.";
  return NextResponse.json({error:message,requestId},{status:failure.status,headers:failureHeaders});
 }
}
