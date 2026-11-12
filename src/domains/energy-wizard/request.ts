export async function readAssessmentRequest(request:Request,limit=8192){
  const url=new URL(request.url),expected=new Set([url.origin]);
  const host=request.headers.get("host");
  if(host && /^[a-z0-9.:[\]-]+$/i.test(host))expected.add(new URL(url.protocol+"//"+host).origin);
  if(!expected.has(request.headers.get("origin")??""))throw Object.assign(Error("Ogiltigt ursprung."),{status:403});
  if(request.headers.get("content-type")?.split(";")[0]!=="application/json")throw Object.assign(Error("JSON krävs."),{status:415});
  const reader=request.body?.getReader();if(!reader)throw Object.assign(Error("Uppgifter saknas."),{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Object.assign(Error("För mycket data."),{status:413});}chunks.push(value);}}finally{reader.releaseLock();}
  const body=new Uint8Array(size);let offset=0;for(const c of chunks){body.set(c,offset);offset+=c.byteLength;}
  try{return JSON.parse(new TextDecoder().decode(body));}catch{throw Object.assign(Error("Ogiltig JSON."),{status:400});}
}
