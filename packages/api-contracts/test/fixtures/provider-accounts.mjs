import { fileURLToPath } from 'node:url';
const id = 'ac100000-0000-4000-8000-000000000001';
const base = {register:{customer_id:id,provider_key:'enode',environment:'sandbox'},revoke:{provider_account_id:id,environment:'sandbox',reason_code:'customer_request'}};
export const cases=[];
function good(kind,name,input=base[kind],expected=input){cases.push({kind,name,input,expected});}
function bad(kind,name,input){cases.push({kind,name,input,error:'VALIDATION_ERROR'});}
for (const kind of ['register','revoke']) {
  good(kind,`${kind} canonical`);
  good(kind,`${kind} production`,{...base[kind],environment:'production'});
  const field=kind==='register'?'customer_id':'provider_account_id';
  good(kind,`${kind} normalized UUID`,{...base[kind],[field]:id.toUpperCase()},base[kind]);
  for(const input of [null,[],42])bad(kind,`${kind} nonobject ${JSON.stringify(input)}`,input);
  for(const environment of [null,'test','Sandbox','sandbox\n',true,12])bad(kind,`${kind} environment ${JSON.stringify(environment)}`,{...base[kind],environment});
  const missing={...base[kind]};delete missing.environment;bad(kind,`${kind} environment required`,missing);
  for(const value of [null,id+'\n','invalid',id.replace('8000','0000')])bad(kind,`${kind} UUID ${JSON.stringify(value)}`,{...base[kind],[field]:value});
  for(const key of ['tenant_id','credential_reference','connection_status','external_account_id','access_token'])bad(kind,`${kind} rejected key ${key}`,{...base[kind],[key]:'untrusted'});
}
good('register','first party without Enode',{...base.register,provider_key:'ocpp'});
for(const key of ['',null,'Enode',' enode','enode\n','1enode','a'.repeat(81),{},1])bad('register',`provider key ${JSON.stringify(key)}`,{...base.register,provider_key:key});
for(const reason of ['security','administrative'])good('revoke',`reason ${reason}`,{...base.revoke,reason_code:reason});
for(const reason of ['',null,'security\n','force',{},1])bad('revoke',`bad reason ${JSON.stringify(reason)}`,{...base.revoke,reason_code:reason});
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(cases));
