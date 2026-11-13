import {planWithSharedEngine} from "@/domains/energy-wizard/shared-engine";
import {readAssessmentRequest} from "@/domains/energy-wizard/request";
export async function POST(request:Request){
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 try{return Response.json(await planWithSharedEngine(await readAssessmentRequest(request,65536)),{headers});}
 catch(error){const status=error&&typeof error==="object"&&"status" in error?Number(error.status):400;return Response.json({error:error instanceof Error?error.message:"Kontrollera planen."},{status:[400,403,413,415,429,502,503].includes(status)?status:400,headers});}
}
