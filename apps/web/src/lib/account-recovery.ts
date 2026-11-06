/** Dedicated recovery page only. Never enable URL-session detection on the normal portal. */
export function recoveryTokens(fragment:string){
 if(fragment.length>24576)return null;
 const p=new URLSearchParams(fragment.replace(/^#/,''));
 if(p.get('type')!=='recovery'||p.has('error')||p.has('error_code'))return null;
 const allowed=['type','access_token','refresh_token','expires_in','expires_at','token_type'];
 if([...p.keys()].some(k=>!allowed.includes(k)||p.getAll(k).length!==1))return null;
 const access_token=p.get('access_token')??'',refresh_token=p.get('refresh_token')??'';
 if(!/^[A-Za-z0-9_.-]{10,16384}$/u.test(access_token)||!/^[A-Za-z0-9_-]{8,4096}$/u.test(refresh_token))return null;
 return {access_token,refresh_token};
}
export const recoveryRedirect='https://staging.flexexa.com/account/activate';
export function matchingPassword(password:string,confirmation:string){return password.length>=12&&password.length<=256&&password===confirmation;}
