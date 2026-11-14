// Public informational pages do not confer API access. Authenticated planning lives in the ECS API.
export async function POST(){return Response.json({error:"PRODUCT_ACCESS_REQUIRED",message:"Logga in i kundportalen. Produktåtkomst måste godkännas av Flexexas superadmin."},{status:403,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
