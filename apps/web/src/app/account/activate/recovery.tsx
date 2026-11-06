'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {FormEvent} from 'react';
import {createClient} from '@supabase/supabase-js';
import type {Session} from '@supabase/supabase-js';
import {matchingPassword,recoveryRedirect,recoveryTokens} from '../../../lib/account-recovery';
export default function AccountActivation({url,publishableKey}:{url:string;publishableKey:string}){
 const client=useMemo(()=>url&&publishableKey?createClient(url,publishableKey,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:false,flowType:'implicit'}}):null,[url,publishableKey]);
 const initialization=useRef<Promise<Session|null>|null>(null);
 const [session,setSession]=useState<Session|null>(null),[busy,setBusy]=useState(Boolean(url&&publishableKey)),[message,setMessage]=useState(''),[finished,setFinished]=useState(false);
 useEffect(()=>{
  if(!client)return;
  if(!initialization.current){
   const tokens=recoveryTokens(window.location.hash);
   window.history.replaceState(null,'',window.location.pathname);
   initialization.current=(async()=>{if(!tokens)return null;const {data,error}=await client.auth.setSession(tokens);if(error||!data.session)throw Error('RECOVERY_EXPIRED');return data.session;})();
  }
  let active=true;
  void initialization.current.then(value=>{if(active)setSession(value);}).catch(()=>{if(active)setMessage('Länken är ogiltig eller har gått ut. Begär en ny länk nedan.');}).finally(()=>{if(active)setBusy(false);});
  return()=>{active=false;};
 },[client]);
 async function requestLink(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!client)return;setBusy(true);setMessage('');const form=event.currentTarget,email=String(new FormData(form).get('email')).trim();try{const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:recoveryRedirect});if(error)throw Error();form.reset();setMessage('Om adressen har ett konto får du ett mejl med en länk. Kontrollera även skräpposten.');}catch{setMessage('Länken kunde inte begäras just nu. Försök igen om en stund.');}finally{setBusy(false);}}
 async function setPassword(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!client||!session)return;const form=event.currentTarget,data=new FormData(form),password=String(data.get('password')),confirmation=String(data.get('confirmation'));if(!matchingPassword(password,confirmation)){setMessage('Använd minst 12 tecken och skriv samma lösenord i båda fälten.');return;}setBusy(true);setMessage('');try{const {error}=await client.auth.updateUser({password});if(error)throw Error();form.reset();setFinished(true);setSession(null);await client.auth.signOut({scope:'local'}).catch(()=>undefined);}catch{setMessage('Lösenordet kunde inte sparas. Länken kan ha gått ut eller lösenordet behöver vara starkare.');}finally{setBusy(false);}}
 return <main style={{maxWidth:640,margin:'40px auto',padding:24,fontFamily:'system-ui,sans-serif',color:'#193b34'}}><a href="/portal" style={{fontSize:30,color:'inherit',textDecoration:'none',fontWeight:750}}>flexexa ✳</a><h1>{finished?'Ditt lösenord är sparat':session?'Välj ditt lösenord':'Aktivera konto eller återställ lösenord'}</h1>
 {!client?<p>Kontoaktivering är inte konfigurerad för denna miljö.</p>:finished?<p>Du kan nu <a href="/portal">logga in i portalen</a> med ditt lösenord. Administratörer aktiverar därefter sin autentiseringsapp.</p>:session?<form onSubmit={setPassword} style={{display:'grid',gap:16}}><p>Du väljer lösenord för {session.user.email}.</p><label>Nytt lösenord<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={256} style={{display:'block',padding:12,width:'100%'}}/></label><label>Bekräfta lösenord<input name="confirmation" type="password" autoComplete="new-password" required minLength={12} maxLength={256} style={{display:'block',padding:12,width:'100%'}}/></label><button disabled={busy} type="submit">Spara mitt lösenord</button></form>:<form onSubmit={requestLink} style={{display:'grid',gap:16}}><p>Har du fått tillgång till Flexexa men ännu inte valt lösenord? Ange din e-postadress så får du en personlig länk. Samma flöde gäller om du har glömt lösenordet.</p><label>E-post<input name="email" type="email" autoComplete="email" required maxLength={254} style={{display:'block',padding:12,width:'100%'}}/></label><button disabled={busy} type="submit">Skicka aktiveringslänk</button><p>Att sätta ett lösenord tilldelar inga nya företags- eller administratörsbehörigheter.</p></form>}
 <p role="status" aria-live="polite">{busy?'Arbetar…':message}</p><p><a href="/portal">Tillbaka till inloggningen</a></p></main>;
}
