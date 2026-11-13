import {validatePlan,formatPlan,planEnergy} from './planner.ts';

const quarter=900000;
function unavailable(status=503):never{throw Object.assign(Error('Planeringen kunde inte slutföras. Försök igen om en stund.'),{status});}
export async function planWithSharedEngine(input:unknown,{origin=process.env.FLEXEXA_ENERGY_ENGINE_ORIGIN,fetcher=fetch}:{origin?:string;fetcher?:typeof fetch}={}){
 const data=validatePlan(input);
 // Existing local scenarios remain explicit when the shared engine is disabled.
 // An enabled engine failure never silently switches calculation algorithms.
 if(!origin)return planEnergy(data);
 let target:URL;try{target=new URL(origin);}catch{return unavailable();}
 if(target.protocol!=='https:'||target.username||target.password||target.search||target.hash||!['','/','/energy','/energy/'].includes(target.pathname))return unavailable();
 const start=Date.parse(data.slots[0]!.start);
 const assets=data.assets.map(a=>({id:a.id,required_wh:Math.ceil((a.kind==='ev'?Math.max(0,a.target_percent!-a.soc_percent!)/100*a.battery_kwh!/a.efficiency!:a.required_kwh!)*1000),max_wh_per_slot:Math.floor(a.max_kw*250),first_slot:(Date.parse(a.available_from)-start)/quarter,end_slot:(Date.parse(a.deadline)-start)/quarter,priority:a.priority,mode:a.mode}));
 if(assets.some(a=>a.required_wh>500000))throw Object.assign(Error('Energibehovet får vara högst 500 kWh per resurs i denna planering.'),{status:400});
 const body={startsAt:data.slots[0]!.start,priceBasis:data.price_basis,problem:{slots:data.slots.map(s=>({available_wh:Math.floor(s.available_kw*250),price_sek_per_kwh:s.price_sek_per_kwh})),assets}};
 let response:Response;
 try{response=await fetcher(target.origin+target.pathname.replace(/\/$/,'')+'/v1/public/energy-plans',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});}catch{return unavailable();}
 if(!response.ok)return unavailable(response.status===429?429:503);
 if(!response.headers.get('content-type')?.includes('application/json'))return unavailable(502);
 const reader=response.body?.getReader();if(!reader)return unavailable(502);const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>262144){await reader.cancel();return unavailable(502);}chunks.push(value);}}catch{return unavailable(502);}finally{reader.releaseLock();}
 const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
 try{
  const result=JSON.parse(new TextDecoder().decode(raw));
  if(result.execution!=='not_dispatched'||!Array.isArray(result.allocations)||!result.unmet_wh||result.starts_at!==body.startsAt||result.price_basis!==body.priceBasis)return unavailable(502);
  const formatted=formatPlan(data,result.allocations);
  if(formatted.assets.some(a=>result.unmet_wh[a.id]!==Math.round(a.unmet_grid_kwh*1000)))return unavailable(502);
  return {...formatted,engine:'shared_aws_planner',engine_version:String(result.version??'unknown')};
 }catch{return unavailable(502);}
}
