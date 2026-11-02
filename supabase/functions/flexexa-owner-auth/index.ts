// Narrow service-role boundary: authenticated server capability, fixed owner only.
Deno.serve(async (request: Request) => {
 if(request.method!=="POST")return new Response(null,{status:405});
 try{
  const input=await request.json();
  if(typeof input.secret!=="string"||input.secret.length!==64)return new Response(null,{status:403});
  const url=Deno.env.get("SUPABASE_URL")!;
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers={apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"};
  const check=await fetch(url+"/rest/v1/rpc/flexexa_applications",{method:"POST",headers,body:JSON.stringify({p_action:"owner_auth",p_secret:input.secret,p_data:{}})});
  if(!check.ok)return new Response(null,{status:403});
  const owner=await check.json();if(owner.limited)return new Response(null,{status:429});
  if(owner.email!=="hekmat.h@div3rsa.com")return new Response(null,{status:403});
  const result=await fetch(url+"/auth/v1/admin/generate_link",{method:"POST",headers,body:JSON.stringify({type:"magiclink",email:owner.email})});
  if(!result.ok)return new Response(null,{status:503});
  const data=await result.json();
  if(!data.hashed_token)return new Response(null,{status:503});
  return Response.json({token_hash:data.hashed_token},{headers:{"Cache-Control":"no-store"}});
 }catch{return new Response(null,{status:503});}
});
