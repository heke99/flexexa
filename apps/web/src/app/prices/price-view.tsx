'use client';
import {useEffect,useState} from 'react';
import {PRICE_AREAS,stockholmDay} from '@flexexa/api-contracts/spot-prices';
import type {normalizeSpotDay} from '@flexexa/api-contracts/spot-prices';
type Prices=ReturnType<typeof normalizeSpotDay>;
export default function PriceView(){
 const [area,setArea]=useState('SE3'),[day,setDay]=useState('today'),[prices,setPrices]=useState<Prices|null>(null),[error,setError]=useState(false),[loading,setLoading]=useState(true);
 useEffect(()=>{
  const controller=new AbortController();
  const today=stockholmDay(new Date()),date=day==='today'?today:stockholmDay(new Date(Date.parse(today+'T12:00:00Z')+86400000));
  fetch(`/api/prices?area=${area}&date=${date}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return await r.json() as Prices;}).then(value=>{if(!controller.signal.aborted)setPrices(value);}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 },[area,day]);
 const rates=prices?.intervals.map(r=>Number(r.spot_sek_per_kwh_ex_vat))??[];
 const money=(v:number)=>v.toLocaleString('sv-SE',{minimumFractionDigits:2,maximumFractionDigits:2});
 return <div style={{background:'#f5f7f2',color:'#193b34',minHeight:'100vh',fontFamily:'system-ui,sans-serif',padding:'28px clamp(16px,5vw,72px)'}}>
  <header style={{display:'flex',justifyContent:'space-between',gap:20,alignItems:'center',marginBottom:42}}><a href="/previews/operations/index.html" style={{fontSize:30,fontWeight:750,textDecoration:'none',color:'inherit'}}>flexexa ✳</a><a href="/portal">Företagsportal</a></header>
  <p style={{fontSize:11,letterSpacing:2}}>ELPRISER · SVERIGE</p><h1 style={{fontSize:'clamp(28px,4vw,44px)',fontWeight:550,letterSpacing:-1}}>Priser för nästa laddning.</h1>
  <p>Publicerade spotpriser från Elpriset just nu. Bilar och laddplaner i förhandsversionen är fortfarande simulerade.</p>
  <div style={{display:'flex',gap:20,flexWrap:'wrap',margin:'30px 0'}}><label>Elområde <select aria-label="Elområde" value={area} onChange={e=>{setLoading(true);setError(false);setPrices(null);setArea(e.target.value);}} style={{padding:12,marginLeft:12}}>{PRICE_AREAS.map(a=><option key={a}>{a}</option>)}</select></label><label>Dag <select aria-label="Dag" value={day} onChange={e=>{setLoading(true);setError(false);setPrices(null);setDay(e.target.value);}} style={{padding:12,marginLeft:12}}><option value="today">Idag</option><option value="tomorrow">Imorgon</option></select></label></div>
  <div role="status" aria-live="polite">{loading?'Hämtar publicerade priser…':error?'Priserna är inte publicerade eller kan inte hämtas just nu. Ingen uppskattning används som ersättning.':`${prices?.area} · ${prices?.date} · ${rates.length} prisintervall`}</div>
  {prices&&!loading&&!error&&<>
   <div style={{display:'flex',gap:25,flexWrap:'wrap',margin:'25px 0'}}>{[['Lägsta',Math.min(...rates)],['Högsta',Math.max(...rates)]].map(([label,value])=><div key={label} style={{background:'white',borderRadius:12,padding:'22px 35px'}}><small>{label}</small><p style={{fontSize:28,margin:'12px 0 0'}}>{money(Number(value))} kr/kWh</p></div>)}</div>
   <p><strong>Spotpris exklusive moms.</strong> Elhandelspåslag, energiskatt, nätavgifter och effektavgift tillkommer enligt kundens avtal. Detta är ingen fullständig laddkostnad.</p>
   <div style={{background:'white',padding:20,borderRadius:12,overflowX:'auto',maxHeight:480,overflowY:'auto',margin:'25px 0'}}><table style={{borderCollapse:'collapse',width:'100%',textAlign:'left'}}><thead><tr><th>Tid i Sverige</th><th>Spotpris kr/kWh, exkl. moms</th></tr></thead><tbody>{prices.intervals.map(r=><tr key={r.starts_at}><td style={{padding:'10px 0',borderBottom:'1px solid #edf0e8'}}>{new Date(r.starts_at).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'})}–{new Date(r.ends_at).toLocaleTimeString('sv-SE',{timeZone:'Europe/Stockholm',hour:'2-digit',minute:'2-digit'})}<small style={{marginLeft:12,color:'#73816e'}}>{new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',timeZoneName:'shortOffset'}).format(new Date(r.starts_at)).split(' ').at(-1)}</small></td><td>{money(Number(r.spot_sek_per_kwh_ex_vat))}</td></tr>)}</tbody></table></div>
   <p style={{fontSize:12}}>Hämtat {new Date(prices.fetched_at).toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'})}. Källa: <a href="https://www.elprisetjustnu.se/elpris-api">Elpriset just nu.se</a>.</p>
  </>}
 </div>;
}
