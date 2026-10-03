import {fileURLToPath} from 'node:url';
const id='ce100000-0000-4000-8000-000000000001';
export const grant={customer_id:id,site_id:id,asset_id:id,environment:'sandbox',consent_type:'remote_control',policy_version:'consent.remote.v1',valid_until:'2099-01-01T00:00:00.000Z',source:'signed_document',evidence_reference:'evidence:abc',evidence_sha256:'a'.repeat(64)};
export const revoke={consent_id:id,environment:'sandbox',reason_code:'customer_request'};
export const check={consent_id:id,customer_id:id,site_id:id,asset_id:id,environment:'sandbox',consent_type:'remote_control',policy_version:'consent.remote.v1'};
export const cases=[];
const good=(kind,name,input,expected=input)=>cases.push({kind,name,input,expected});
const bad=(kind,name,input)=>cases.push({kind,name,input,error:'VALIDATION_ERROR'});
for(const [kind,base] of Object.entries({grant,revoke,check})){
 good(kind,`${kind} canonical`,base);
 good(kind,`${kind} production`,{...base,environment:'production'});
 for(const p of [null,[],false,4])bad(kind,`${kind} nonobject ${JSON.stringify(p)}`,p);
 for(const [key,value] of Object.entries(base)){
  const missing={...base};delete missing[key];
  bad(kind,`${kind} missing ${key}`,missing);
  if(key!=='asset_id')bad(kind,`${kind} null ${key}`,{...base,[key]:null});
  if(typeof value==='string')bad(kind,`${kind} newline ${key}`,{...base,[key]:value+'\n'});
 }
 for(const key of ['tenant_id','actor_id','status','granted_at','access_token','evidence_json'])bad(kind,`${kind} forbidden ${key}`,{...base,[key]:'spoof'});
 for(const environment of ['test','Sandbox',{},1])bad(kind,`${kind} environment ${JSON.stringify(environment)}`,{...base,environment});
}
for(const kind of ['grant','check']){
 const base=kind==='grant'?grant:check;
 good(kind,`${kind} customer scope`,{...base,site_id:null,asset_id:null});
 good(kind,`${kind} site scope`,{...base,asset_id:null});
 good(kind,`${kind} normalized IDs`,{...base,customer_id:id.toUpperCase(),site_id:id.toUpperCase(),asset_id:id.toUpperCase()},base);
 bad(kind,`${kind} asset without site`,{...base,site_id:null});
 for(const type of ['smart_charging','flex_participation','data_sharing','vehicle_api','location','market_participation'])good(kind,`${kind} independent purpose ${type}`,{...base,consent_type:type});
 for(const type of ['', 'control','remote_control ',1,{}])bad(kind,`${kind} type ${JSON.stringify(type)}`,{...base,consent_type:type});
 for(const version of ['', 'v1 ', 'a'.repeat(129),'https://untrusted',{}])bad(kind,`${kind} version ${JSON.stringify(version)}`,{...base,policy_version:version});
}
for(const source of ['customer_portal','support_verified'])good('grant',`source ${source}`,{...grant,source});
for(const source of ['admin','oauth',{},1])bad('grant',`source ${JSON.stringify(source)}`,{...grant,source});
for(const stamp of ['2026-02-30T00:00:00.000Z','2099-01-01T00:00:00Z','2099-01-01T00:00:00.000+00:00','infinity','0000-01-01T00:00:00.000Z'])bad('grant',`timestamp ${stamp}`,{...grant,valid_until:stamp});
for(const hash of ['A'.repeat(64),'a'.repeat(63),'g'.repeat(64),1])bad('grant',`evidence hash ${hash}`,{...grant,evidence_sha256:hash});
for(const ref of ['', 'https://private.example/document','a'.repeat(129),'customer name'])bad('grant',`evidence reference ${ref}`,{...grant,evidence_reference:ref});
for(const reason of ['security','administrative'])good('revoke',`reason ${reason}`,{...revoke,reason_code:reason});
for(const reason of ['expired','force',{},1])bad('revoke',`reason ${JSON.stringify(reason)}`,{...revoke,reason_code:reason});
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(cases));
