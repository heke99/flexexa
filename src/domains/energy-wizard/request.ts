import { readBoundedJson } from "../../lib/bounded-json-request.ts";

export async function readAssessmentRequest(request:Request,limit=8192){
  const url=new URL(request.url),expected=new Set([url.origin]);
  const host=request.headers.get("host");
  if(host && /^[a-z0-9.:[\]-]+$/i.test(host))expected.add(new URL(url.protocol+"//"+host).origin);
  if(!expected.has(request.headers.get("origin")??""))throw Object.assign(Error("Ogiltigt ursprung."),{status:403});
  if(request.headers.get("content-type")?.split(";")[0]!=="application/json")throw Object.assign(Error("JSON krävs."),{status:415});
  return readBoundedJson(request,limit);
}
