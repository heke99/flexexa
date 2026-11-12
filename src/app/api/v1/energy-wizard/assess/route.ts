import {assessProfile} from "@/domains/energy-wizard/assessment";
import {readAssessmentRequest} from "@/domains/energy-wizard/request";

export async function POST(request:Request){
  const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
  try{return Response.json(assessProfile(await readAssessmentRequest(request)),{headers});}
  catch(error){const status=error && typeof error==="object" && "status" in error?Number(error.status):400;return Response.json({error:error instanceof Error?error.message:"Kontrollera uppgifterna."},{status:[400,403,413,415].includes(status)?status:400,headers});}
}
