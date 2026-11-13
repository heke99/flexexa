import {partnerCatalog} from "@/domains/partner-offers/catalog";

export async function GET(_request:Request,{params}:{params:Promise<{partner:string}>}){
  const catalog=partnerCatalog((await params).partner);
  return Response.json(catalog??{error:"PARTNER_NOT_FOUND"},{status:catalog?200:404,headers:{"Cache-Control":"public, max-age=60, s-maxage=60","Access-Control-Allow-Origin":"*","X-Content-Type-Options":"nosniff"}});
}
