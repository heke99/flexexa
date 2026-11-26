"use client";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect,useRef,useState} from "react";
import type {AdminApplicationPage} from "@/domains/applications/admin-page";
const states:Record<string,string>={sent:'Accepterat av mejltjänsten',pending:'I kö / nytt försök',processing:'Skickas',failed:'Kunde inte skickas',review:'Kräver kontroll'};
export function AdminApplications({view="applications"}:{view?:"overview"|"applications"|"settings"}){
 const router=useRouter();
 const [data,setData]=useState<AdminApplicationPage|null>(null),[pageCursors,setPageCursors]=useState<(string|null)[]>([null]),[listBusy,setListBusy]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[token,setToken]=useState('');
 const [logoutState,setLogoutState]=useState<"idle"|"pending"|"failed">("idle");
 const [listUnavailable,setListUnavailable]=useState(false);
 const listRequest=useRef<AbortController|null>(null);
 async function load(cursors:(string|null)[]){
  listRequest.current?.abort();
  const operation=new AbortController();
  listRequest.current=operation;
  setListBusy(true);
  const cursor=cursors.at(-1);
  const query=cursor?`?${new URLSearchParams({cursor})}`:'';
  try{
   const response=await fetch(`/api/admin/applications${query}`,{cache:'no-store',signal:operation.signal});
   const result:AdminApplicationPage|null=response.ok?await response.json():null;
   if(operation.signal.aborted)return;
   if(result){setData(result);setPageCursors(cursors);setListUnavailable(false);if(listUnavailable)setMessage('');return;}
   setData(null);
   setListUnavailable(response.status!==401&&response.status!==403);
   if(response.status===401&&view!=="overview"&&!window.location.hash)router.replace("/admin");
   if(response.status===403)setMessage('Åtkomsten kunde inte verifieras. Logga in på nytt.');
   if(response.status!==401&&response.status!==403){
    setPageCursors(cursors);
    setMessage('Listan kunde inte hämtas. Försök igen.');
   }
  }catch{
   if(operation.signal.aborted)return;
   setData(null);
   setListUnavailable(true);
   setPageCursors(cursors);
   setMessage('Listan kunde inte hämtas. Försök igen.');
  }finally{
   if(listRequest.current===operation){listRequest.current=null;setListBusy(false);}
  }
 }
 async function logout(){
  if(logoutState==="pending")return;
  setLogoutState("pending");
  listRequest.current?.abort();
  listRequest.current=null;
  setListBusy(false);
  setListUnavailable(false);
  setData(null);
  setPageCursors([null]);
  setMessage("");
  try{
   const response=await fetch("/api/admin/session",{
    method:"DELETE",cache:"no-store",redirect:"error",signal:AbortSignal.timeout(10_000),
   });
   if(!response.ok||(await response.json())?.ok!==true)throw Error();
   setLogoutState("idle");
   setMessage("Du är utloggad.");
  }catch{
   setLogoutState("failed");
   setMessage("Utloggningen kunde inte bekräftas.");
  }
 }
 useEffect(()=>{const hash=new URLSearchParams(window.location.hash.slice(1));const value=hash.get('token_hash');if(value){queueMicrotask(()=>setToken(value));history.replaceState(null,'',window.location.pathname);}else queueMicrotask(()=>void load([null]));
 return ()=>listRequest.current?.abort();
 // The initial session check runs once for this portal page.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 async function confirm(){setBusy(true);try{const r=await fetch('/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token_hash:token})});const result=await r.json();if(!r.ok)throw Error(result.error);setToken('');setMessage('');await load([null]);}catch(e){setToken('');setMessage(e instanceof Error?e.message:'Inloggningen misslyckades.');}finally{setBusy(false);}}
 async function login(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);const form=new FormData(e.currentTarget);try{const r=await fetch('/api/admin/session',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:form.get('email'),password:form.get('password')})});const result=await r.json();if(result.ok){await load([null]);setMessage("");}else setMessage(result.message||result.error);}catch{setMessage('Mejlet kunde inte begäras. Försök igen.');}finally{setBusy(false);}}
 async function savePassword(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=e.currentTarget;setBusy(true);try{const r=await fetch("/api/admin/session",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:new FormData(f).get("password")})});const d=await r.json();setMessage(d.message||d.error);if(r.ok)f.reset();}catch{setMessage("Lösenordet kunde inte sparas.");}finally{setBusy(false);}}
 return <>{message&&<p role="status" className="form-status">{message}</p>}{logoutState==="pending"?<p role="status">Loggar ut…</p>:logoutState==="failed"?<button className="button" onClick={logout}>Försök logga ut igen</button>:listUnavailable?<div className="actions"><button className="button" disabled={listBusy} onClick={()=>void load(pageCursors)}>Försök hämta listan igen</button><button className="button secondary" onClick={logout}>Logga ut</button></div>:token?<div className="contact-form"><h2>Bekräfta inloggning.</h2><p>Fortsätt till superadminportalen med din personliga engångslänk.</p><button className="button primary" onClick={confirm} disabled={busy}>{busy?'Verifierar…':'Bekräfta inloggning'}</button></div>:!data?<form className="contact-form admin-login" onSubmit={login}><h2>Logga in.</h2><p>Endast behörig superadmin har tillgång till personuppgifter.</p><label>Mejladress<input type="email" name="email" autoComplete="email" required/></label><label>Lösenord<input name="password" type="password" autoComplete="current-password" maxLength={128}/></label><p className="fine">Lämna lösenordet tomt för att få en inloggningslänk, till exempel om du glömt lösenordet.</p><button className="button primary" disabled={busy}>{busy?'Skickar…':'Logga in / skicka länk'}</button></form>:<><nav className="actions" aria-label="Superadminnavigation"><Link className="text-link" href="/admin">Översikt</Link><Link className="text-link" href="/admin/ansokningar">Ansökningar</Link><Link className="text-link" href="/admin/installningar">Kontoinställningar</Link></nav>{view==="settings"&&<details open><summary>Sätt eller ändra lösenord</summary><form className="contact-form admin-login" onSubmit={savePassword}><label>Nytt lösenord<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><button className="button primary" disabled={busy}>Spara lösenord</button></form></details>}<div className="admin-toolbar"><div><strong>{data.count} registrerade platser</strong><p>{data.base} startplatser + {data.new} nya ansökningar. Tekniska tester räknas inte.</p></div><button className="button small" disabled={listBusy} onClick={()=>load(pageCursors)}>Uppdatera</button><button className="text-link" disabled={busy} onClick={logout}>Logga ut</button></div>{view==="overview"&&<div className="offer-grid"><Link className="offer-card energy-offer" href="/admin/ansokningar"><span className="eyebrow">ELBILSABONNEMANG</span><h2>Ansökningar</h2><p>{data.new} nya ansökningar. Öppna registret för kontaktuppgifter, erbjudandegrupper och mejlstatus.</p><span>Hantera ansökningar ↗</span></Link><Link className="offer-card charge-offer" href="/admin/installningar"><span className="eyebrow">DITT KONTO</span><h2>Kontoinställningar</h2><p>Hantera lösenordet för din superadmininloggning.</p><span>Öppna inställningar ↗</span></Link></div>}{view==="applications"&&<><p className="fine">Mejlstatus visar leverantörens mottagande, inte en garanti om leverans till inkorgen. Begärd rättelse, radering och återkallat samtycke hanteras via info@flexexa.com.</p><div className="table-scroll admin-table"><table><thead><tr><th>Plats / erbjudande</th><th>Sökande</th><th>Bil / körsträcka</th><th>Samtycke</th><th>Bekräftelsemejl</th><th>Registrerad</th></tr></thead><tbody>{data.applications.map(a=><tr key={a.id}><td>{a.is_test?'TEST':a.position}<br/>{a.offer_group==='first_1000'?'Specialerbjudande':a.offer_group==='following'?'Nästa erbjudande':'Tekniskt test'}</td><td>{a.first_name} {a.last_name}<br/><a href={`mailto:${a.email}`}>{a.email}</a></td><td>{a.car}<br/>{a.annual_miles} mil/år</td><td>Erbjudandeutskick: {a.marketing_consent?'Ja':'Nej'}<br/><small>{a.privacy_version}</small></td><td>{a.email_state ? states[a.email_state] : 'Mejlstatus saknas'}{a.attempts!==null&&<><br/><small>{a.attempts} försök{a.last_error?` / ${a.last_error}`:''}</small></>}{a.provider_id&&<details><summary>Mejlreferens</summary><small>{a.provider_id}</small></details>}</td><td>{new Date(a.created_at).toLocaleString('sv-SE',{timeZone:'Europe/Stockholm'})}</td></tr>)}</tbody></table>{!data.applications.length&&<p>Inga ansökningar på denna sida.</p>}</div><div className="actions"><button className="button small" disabled={listBusy||pageCursors.length===1} onClick={()=>load(pageCursors.slice(0,-1))}>Föregående</button><span>Sida {pageCursors.length}</span><button className="button small" disabled={listBusy||!data.nextCursor} onClick={()=>load([...pageCursors,data.nextCursor])}>Nästa</button></div></>}</>}</>;
}
