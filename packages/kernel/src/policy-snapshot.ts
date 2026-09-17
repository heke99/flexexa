import {DomainError,entityId,tenantId,record,exactKeys,utcInstant,assertSameTenant} from '@flexexa/domain';
import {connectEnvironment} from '@flexexa/domain/connect';
import {intersectPowerPolicy} from './index.ts';

const deny=()=>{throw new DomainError('POLICY_DENIED');};
const keyId=(value:unknown)=>{if(typeof value!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/u.test(value))throw new DomainError('VALIDATION_ERROR');return value;};
const checksum=(value:unknown)=>{if(typeof value!=='string'||!/^[0-9a-f]{64}$/u.test(value))throw new DomainError('VALIDATION_ERROR');return value;};
function scope(value:unknown){
 const s=record(value);exactKeys(s,['type','id','environment']);
 if(s.type!=='tenant'&&s.type!=='site'&&s.type!=='asset')throw new DomainError('VALIDATION_ERROR');
 return Object.freeze({type:s.type,id:entityId(s.id),environment:connectEnvironment(s.environment)});
}
/** Canonical power-only snapshot. No authority to publish or control is granted by parsing. */
function payload(value:unknown){
 const p=record(value);exactKeys(p,['tenant_id','scope','policy_set_version_id','rules_checksum','valid_from','valid_until','compiled_constraints']);
 const tenant=tenantId(p.tenant_id),target=scope(p.scope),version=entityId(p.policy_set_version_id);
 if(target.type==='tenant'&&String(target.id)!==String(tenant))throw new DomainError('TENANT_MISMATCH');
 const start=utcInstant(p.valid_from),end=utcInstant(p.valid_until);if(start>=end)throw new DomainError('VALIDATION_ERROR');
 const c=record(p.compiled_constraints);exactKeys(c,['minimum_kw','maximum_kw','deny_reasons','applied_rule_versions']);
 if(!Array.isArray(c.applied_rule_versions)||c.applied_rule_versions.length===0||c.applied_rule_versions.length>1024)throw new DomainError('VALIDATION_ERROR');
 const versions=Object.freeze([...new Set(Array.from(c.applied_rule_versions,entityId))].sort());
 // Reuse the same runtime validation and conservative composition as ordinary Kernel decisions.
 const minimum=c.minimum_kw,maximum=c.maximum_kw;
 const decision=intersectPowerPolicy({tenant_id:tenant,policy_set_version_id:version,valid_from:start,valid_until:end,
  limits:[{rule_version_id:versions[0]!,minimum_kw:minimum as number,maximum_kw:maximum as number}],deny_reasons:c.deny_reasons as string[]},tenant,start);
 const constraints=Object.freeze({minimum_kw:minimum as number,maximum_kw:maximum as number,
  deny_reasons:decision.reason_codes,applied_rule_versions:versions});
 return Object.freeze({tenant_id:tenant,scope:target,policy_set_version_id:version,rules_checksum:checksum(p.rules_checksum),
  valid_from:start,valid_until:end,compiled_constraints:constraints});
}
export type PowerSnapshotPayload=ReturnType<typeof payload>;
export interface PowerSnapshot extends PowerSnapshotPayload {
 readonly signature:Readonly<{algorithm:'Ed25519';key_id:string;value:string}>;
}
export interface SnapshotTrust {
 readonly tenant_id:string;
 readonly scope:Readonly<{type:'tenant'|'site'|'asset';id:string;environment:'sandbox'|'production'}>;
 readonly policy_set_version_id:string;
 readonly rules_checksum:string;
 readonly key_id:string;
 readonly public_key:CryptoKey;
 readonly key_valid_from:string;
 readonly key_valid_until:string;
}
const bytes=(p:PowerSnapshotPayload,kid:string)=>new TextEncoder().encode('flexexa.power-policy-snapshot.v1\n'+JSON.stringify({key_id:kid,payload:p}));
function encode(value:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');}
function signatureBytes(value:unknown){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]{86}$/u.test(value))return deny();
 const decoded=Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'=='),c=>c.charCodeAt(0));
 if(decoded.length!==64||encode(decoded.buffer)!==value)return deny();return decoded;
}
/** Trusted publisher primitive only. Authorization, approval and durable audit precede this call. */
export async function signPowerSnapshot(value:unknown,kid:string,privateKey:CryptoKey):Promise<PowerSnapshot>{
 const p=payload(value),id=keyId(kid);
 if(privateKey?.type!=='private'||privateKey.algorithm.name!=='Ed25519'||!privateKey.usages.includes('sign'))throw new DomainError('VALIDATION_ERROR');
 const signature=encode(await crypto.subtle.sign('Ed25519',privateKey,bytes(p,id)));
 return Object.freeze({...p,signature:Object.freeze({algorithm:'Ed25519',key_id:id,value:signature})});
}
/** Trust comes from authenticated routing/current publication state, never from the received snapshot. */
export async function verifyPowerSnapshot(value:unknown,trust:SnapshotTrust,effectiveAt:string):Promise<PowerSnapshotPayload>{
 const input=record(value);exactKeys(input,['tenant_id','scope','policy_set_version_id','rules_checksum','valid_from','valid_until','compiled_constraints','signature']);
 const {signature:raw,...unsigned}=input,p=payload(unsigned),signature=record(raw);exactKeys(signature,['algorithm','key_id','value']);
 const expectedTenant=tenantId(trust.tenant_id),target=scope(trust.scope),now=utcInstant(effectiveAt);
 assertSameTenant(expectedTenant,p.tenant_id);
 if(p.scope.type!==target.type||p.scope.id!==target.id||p.scope.environment!==target.environment||
  p.policy_set_version_id!==entityId(trust.policy_set_version_id)||p.rules_checksum!==checksum(trust.rules_checksum)||
  now<p.valid_from||now>=p.valid_until||now<utcInstant(trust.key_valid_from)||now>=utcInstant(trust.key_valid_until)||
  signature.algorithm!=='Ed25519'||signature.key_id!==keyId(trust.key_id))return deny();
 const key=trust.public_key;
 if(key?.type!=='public'||key.algorithm.name!=='Ed25519'||!key.usages.includes('verify'))return deny();
 const signed=signatureBytes(signature.value);
 let valid=false;try{valid=await crypto.subtle.verify('Ed25519',key,signed,bytes(p,trust.key_id));}catch{return deny();}
 if(!valid)return deny();return p;
}
