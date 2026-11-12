import {planEnergy} from "@/domains/energy-wizard/planner";
import {readAssessmentRequest} from "@/domains/energy-wizard/request";
export async function POST(request:Request){
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
 try{return Response.json(planEnergy(await readAssessmentRequest(request,65536)),{headers});}
 catch(error){const status=error&&typeof error==="object"&&"status" in error?Number(error.status):400;return Response.json({error:error instanceof Error?error.message:"Kontrollera planen."},{status:[400,403,413,415].includes(status)?status:400,headers});}
}
