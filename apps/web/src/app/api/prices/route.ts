import {DomainError} from '@flexexa/domain';
import {priceRequest,stockholmDay} from '@flexexa/api-contracts/spot-prices';
import {readSpotPrices} from '../../../lib/spot-prices';
export const runtime='nodejs';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams;
 try{
  if([...p.keys()].some(k=>k!=='area'&&k!=='date')||p.getAll('area').length>1||p.getAll('date').length>1)throw new DomainError('VALIDATION_ERROR');
  const input=priceRequest(p.get('area'),p.get('date'));
  const today=stockholmDay(new Date()),tomorrow=stockholmDay(new Date(Date.parse(today+'T12:00:00Z')+86400000));
  if(input.date!==today&&input.date!==tomorrow)throw new DomainError('VALIDATION_ERROR');
  return Response.json(await readSpotPrices(input.area,input.date),{headers:{'Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'}});
 }catch(error){return Response.json({error:error instanceof DomainError?'INVALID_REQUEST':'PRICE_UNAVAILABLE'}, {status:error instanceof DomainError?400:503,headers:{'Cache-Control':'no-store'}});}
}
