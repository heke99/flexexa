export const plannerVersion="flexexa-energy-plan-2026-11-12-v1";
type Slot={start:string;price_sek_per_kwh:number;available_kw:number};
type BaseAsset={id:string;name:string;kind:"ev"|"load";mode:"smart"|"now"|"paused";available_from:string;deadline:string;max_kw:number;priority:number};
export type PlanAsset=BaseAsset & {battery_kwh?:number;soc_percent?:number;target_percent?:number;efficiency?:number;required_kwh?:number};
export type PlanInput={price_basis:"including_vat"|"excluding_vat";slots:Slot[];assets:PlanAsset[]};
const quarter=15*60*1000;
const invalid=(message:string):never=>{throw Error(message);};
function time(value:unknown){if(typeof value!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value))return invalid("Tider ska anges med tidszon i ISO-format.");const parts=value.slice(0,10).split("-").map(Number),calendar=new Date(Date.UTC(parts[0]!,parts[1]!-1,parts[2]!));if(calendar.toISOString().slice(0,10)!==value.slice(0,10))return invalid("Datumet finns inte.");const n=Date.parse(value);if(!Number.isFinite(n)||n%quarter!==0)return invalid("Tider ska ligga på hela kvartar.");return n;}
function number(value:unknown,min:number,max:number){if(typeof value!=="number"||!Number.isFinite(value)||value<min||value>max)invalid("Kontrollera energi, effekt och prisvärden.");return value as number;}
function object(value:unknown,keys:string[]){if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))invalid("Planen innehåller ogiltiga eller okända fält.");return value as Record<string,unknown>;}

export function validatePlan(input:unknown):PlanInput{
 const data=object(input,["price_basis","slots","assets"]);
 if(!["including_vat","excluding_vat"].includes(data.price_basis as string))invalid("Ange om prisserien inkluderar moms.");
 if(!Array.isArray(data.slots)||data.slots.length<1||data.slots.length>96)invalid("Prisserien ska innehålla 1–96 sammanhängande kvartar.");
 const slots=(data.slots as unknown[]).map((raw,index)=>{const s=object(raw,["start","price_sek_per_kwh","available_kw"]),stamp=time(s.start);if(index&&stamp!==time((data.slots as Slot[])[index-1]!.start)+quarter)invalid("Kvartarna ska vara sammanhängande och sorterade utan dubbletter.");return{start:new Date(stamp).toISOString(),price_sek_per_kwh:number(s.price_sek_per_kwh,-100,100),available_kw:number(s.available_kw,0,350)};});
 if(!Array.isArray(data.assets)||data.assets.length<1||data.assets.length>12)invalid("Planen ska innehålla 1–12 resurser.");
 const seen=new Set<string>(),start=time(slots[0]!.start),end=time(slots.at(-1)!.start)+quarter;
 const assets=(data.assets as unknown[]).map(raw=>{
  const a=object(raw,["id","name","kind","mode","available_from","deadline","max_kw","priority","battery_kwh","soc_percent","target_percent","efficiency","required_kwh"]);
  if(typeof a.id!=="string"||! /^[a-zA-Z0-9_-]{1,64}$/.test(a.id)||seen.has(a.id))invalid("Varje resurs behöver ett unikt id.");seen.add(a.id as string);
  if(typeof a.name!=="string"||!a.name.trim()||a.name.length>80||/[\u0000-\u001f]/.test(a.name))invalid("Ange ett kort namn på varje resurs.");
  if(!["ev","load"].includes(a.kind as string)||!["smart","now","paused"].includes(a.mode as string))invalid("Välj resurstyp och smart, nu eller pausat läge.");
  const from=time(a.available_from),deadline=time(a.deadline);if(from<start||deadline>end||from>=deadline)invalid("Start och avresa/sluttid ska rymmas i prisserien och vara i rätt ordning.");
  const priority=number(a.priority??1,1,3);if(!Number.isInteger(priority))invalid("Prioritet ska vara 1, 2 eller 3.");
  const base:BaseAsset={id:a.id as string,name:(a.name as string).trim(),kind:a.kind as "ev"|"load",mode:a.mode as BaseAsset["mode"],available_from:new Date(from).toISOString(),deadline:new Date(deadline).toISOString(),max_kw:number(a.max_kw,0.1,350),priority};
  if(a.kind==="ev"){if(a.required_kwh!==undefined)invalid("Bilens energibehov ska beräknas från batteri och laddmål.");return{...base,battery_kwh:number(a.battery_kwh,1,250),soc_percent:number(a.soc_percent,0,100),target_percent:number(a.target_percent,0,100),efficiency:number(a.efficiency,0.5,1)};}
  if(["battery_kwh","soc_percent","target_percent","efficiency"].some(k=>a[k]!==undefined))invalid("En flexibel last ska ange energibehov, inte bilens batterivärden.");
  return{...base,required_kwh:number(a.required_kwh,0,500)};
 });
 return{price_basis:data.price_basis as PlanInput["price_basis"],slots,assets};
}

type Edge={to:number;rev:number;cap:number;cost:number;initial:number};
// Integral Wh min-cost max-flow permits rerouting previous allocations. A
// cheapest-slot greedy pass alone can strand a car with an earlier deadline.
function allocate(demand:number[],caps:number[],links:{asset:number;slot:number;cap:number;cost:number}[],priority:number[]){
 const source=0,firstAsset=1,firstSlot=firstAsset+demand.length,sink=firstSlot+caps.length,n=sink+1,graph:Edge[][]=Array.from({length:n},()=>[]),tracked:{asset:number;slot:number;edge:Edge}[]=[];
 function edge(from:number,to:number,cap:number,cost:number){const e={to,rev:graph[to]!.length,cap,cost,initial:cap};graph[from]!.push(e);graph[to]!.push({to:from,rev:graph[from]!.length-1,cap:0,cost:-cost,initial:0});return e;}
 demand.forEach((d,i)=>edge(source,firstAsset+i,d,priority[i]!));caps.forEach((c,i)=>edge(firstSlot+i,sink,c,0));
 for(const l of links)tracked.push({asset:l.asset,slot:l.slot,edge:edge(firstAsset+l.asset,firstSlot+l.slot,l.cap,l.cost)});
 const potential=Array(n).fill(Infinity);potential[source]=0;
 for(let pass=0;pass<n-1;pass++){let changed=false;for(let v=0;v<n;v++)if(Number.isFinite(potential[v]))for(const e of graph[v]!)if(e.cap>0&&potential[e.to]>potential[v]+e.cost){potential[e.to]=potential[v]+e.cost;changed=true;}if(!changed)break;}
 for(let i=0;i<n;i++)if(!Number.isFinite(potential[i]))potential[i]=0;
 for(let iteration=0;iteration<2000;iteration++){
  const dist=Array(n).fill(Infinity),used=Array(n).fill(false),previousNode=Array(n).fill(-1),previousEdge=Array(n).fill(-1);dist[source]=0;
  for(let pass=0;pass<n;pass++){let v=-1;for(let i=0;i<n;i++)if(!used[i]&&(v<0||dist[i]<dist[v]))v=i;if(v<0||!Number.isFinite(dist[v]))break;used[v]=true;
   for(let k=0;k<graph[v]!.length;k++){const e=graph[v]![k]!;if(e.cap<=0||used[e.to])continue;const next=dist[v]+e.cost+potential[v]-potential[e.to];if(next<dist[e.to]){dist[e.to]=next;previousNode[e.to]=v;previousEdge[e.to]=k;}}
  }
  if(!Number.isFinite(dist[sink]))return tracked.map(x=>({asset:x.asset,slot:x.slot,wh:x.edge.initial-x.edge.cap}));
  for(let i=0;i<n;i++)if(Number.isFinite(dist[i]))potential[i]+=dist[i];
  let amount=Infinity;for(let v=sink;v!==source;v=previousNode[v])amount=Math.min(amount,graph[previousNode[v]]![previousEdge[v]]!.cap);
  for(let v=sink;v!==source;v=previousNode[v]){const e=graph[previousNode[v]]![previousEdge[v]]!;e.cap-=amount;graph[v]![e.rev]!.cap+=amount;}
 }
 return invalid("Planeringen nådde beräkningsgränsen. Dela upp planen i färre resurser.");
}

export function planEnergy(input:unknown){
 const data=validatePlan(input),start=time(data.slots[0]!.start),demand=data.assets.map(a=>Math.ceil((a.kind==="ev"?Math.max(0,a.target_percent!-a.soc_percent!)/100*a.battery_kwh!/a.efficiency!:a.required_kwh!)*1000));
 const caps=data.slots.map(s=>Math.floor(s.available_kw*250)),priority=data.assets.map(a=>-(a.mode==="now"?1e12:0)-a.priority*1e9-(96-(time(a.deadline)-start)/quarter)*1e7),links:{asset:number;slot:number;cap:number;cost:number}[]=[];
 data.assets.forEach((a,i)=>{if(a.mode==="paused")return;data.slots.forEach((s,j)=>{const t=time(s.start);if(t>=time(a.available_from)&&t+quarter<=time(a.deadline))links.push({asset:i,slot:j,cap:Math.floor(a.max_kw*250),cost:Math.round(s.price_sek_per_kwh*10000)+(a.mode==="now"?j*1e8:0)});});});
 const allocations=allocate(demand.map((d,i)=>data.assets[i]!.mode==="paused"?0:d),caps,links,priority),matrix=data.assets.map(()=>data.slots.map(()=>0));for(const a of allocations)matrix[a.asset]![a.slot]=a.wh;
 const schedule=data.slots.map((s,j)=>({...s,end:new Date(time(s.start)+quarter).toISOString(),allocated_kwh:matrix.reduce((sum,row)=>sum+row[j]!,0)/1000,actions:data.assets.map((a,i)=>({asset_id:a.id,power_kw:matrix[i]![j]!/250,action:matrix[i]![j]!>0?"charge_or_run":"pause"}))}));
 const assets=data.assets.map((a,i)=>{const supplied=matrix[i]!.reduce((sum,n)=>sum+n,0),unmet=Math.max(0,demand[i]!-supplied),cost=matrix[i]!.reduce((sum,wh,j)=>sum+wh/1000*data.slots[j]!.price_sek_per_kwh,0);return{id:a.id,name:a.name,kind:a.kind,mode:a.mode,required_grid_kwh:demand[i]!/1000,planned_grid_kwh:supplied/1000,unmet_grid_kwh:unmet/1000,estimated_energy_cost_minor:Math.round(cost*100),status:a.mode==="paused"?"paused":unmet>0?"insufficient_time_or_power":"target_planned",...(a.kind==="ev"?{projected_soc_percent:Math.min(100,a.soc_percent!+supplied/1000*a.efficiency!/a.battery_kwh!*100)}:{}),available_from:a.available_from,deadline:a.deadline};});
 return{version:plannerVersion,execution:"not_dispatched",currency:"SEK",price_basis:data.price_basis,resolution_minutes:15,feasible:assets.every(a=>a.unmet_grid_kwh===0),estimated_energy_cost_minor:assets.reduce((sum,a)=>sum+a.estimated_energy_cost_minor,0),assets,schedule,assumptions:["Planering med reglerbar medeleffekt mellan 0 och angiven maxeffekt. Faktisk utrustnings minström, faser och säkerhetsgränser måste verifieras före körning.","Tillgänglig effekt och priser kommer från anropet och är inte verifierade livevärden. Ingen Grid Rewards-ersättning eller annan utbetalning beräknas.","Målen prioriteras före pris. Vid effektbrist prioriteras Ladda nu, angiven prioritet och tidigare deadline. En pausad resurs får ingen energi.","Förslagen är inga utförda kommandon. Faktisk styrning kräver autentiserat kundmandat, resursägarskap, aktuell mätning och verifierad adapter."],warnings:assets.filter(a=>a.unmet_grid_kwh>0).map(a=>({asset_id:a.id,message:a.status==="paused"?"Resursen är pausad av kunden; målet planeras inte.":"Laddmålet ryms inte före avresa med tillgänglig tid och effekt.",unmet_grid_kwh:a.unmet_grid_kwh}))};
}
