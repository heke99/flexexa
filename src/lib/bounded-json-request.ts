export class JsonRequestError extends Error {
 readonly status: 400 | 413;

 constructor(message: string, status: 400 | 413) {
  super(message);
  this.status = status;
 }
}

export async function readBoundedJson(request: Request, limit: number): Promise<unknown> {
 const reader = request.body?.getReader();
 if (!reader) throw new JsonRequestError("Uppgifter saknas.", 400);
 const chunks: Uint8Array[] = [];
 let size = 0;
 try {
  while (true) {
   const {value, done} = await reader.read();
   if (done) break;
   size += value.byteLength;
   if (size > limit) {
    await reader.cancel();
    throw new JsonRequestError("För mycket data.", 413);
   }
   chunks.push(value);
  }
 } finally {
  reader.releaseLock();
 }
 const body = new Uint8Array(size);
 let offset = 0;
 for (const chunk of chunks) {
  body.set(chunk, offset);
  offset += chunk.byteLength;
 }
 try {
  return JSON.parse(new TextDecoder().decode(body));
 } catch {
  throw new JsonRequestError("Ogiltig JSON.", 400);
 }
}
