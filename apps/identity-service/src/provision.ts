import {DomainError,exactKeys,record} from '@flexexa/domain';
import {createIdentityExecutionLeaseApi,createIdentityProvisioningFinalizationApi,identityExecutionLeaseCheckRpc,identityProvisioningFinalizationRpc} from '@flexexa/api-contracts/identity-administration';
import type {IdentityExecutionLeaseClient,IdentityProvisioningFinalizationClient,parseIdentityExecutionLeaseCheck} from '@flexexa/api-contracts/identity-administration';
import type {MachinePermissionScope} from '@flexexa/api-contracts/machine-authorization';
export type ReservedIdentity=ReturnType<typeof parseIdentityExecutionLeaseCheck>;
export interface ReservedAuthAdmin {
 find(identity:ReservedIdentity):Promise<boolean>;
 create(identity:ReservedIdentity):Promise<void>;
}
/** SQL is the authority. Privileged Auth calls are never made from a receipt alone. */
export function createProvisioner(rpc:IdentityExecutionLeaseClient & IdentityProvisioningFinalizationClient,admin:ReservedAuthAdmin,scope:MachinePermissionScope){
 const leases=createIdentityExecutionLeaseApi(rpc,scope),finalizer=createIdentityProvisioningFinalizationApi(rpc,scope);
 return Object.freeze({async execute(value:unknown){
  const p=record(value);exactKeys(p,['lease','idempotency_key','correlation_id']);
  const lease=identityExecutionLeaseCheckRpc(p.lease,scope).expected;
  const request={tenant_id:lease.tenant_id,idempotency_key:p.idempotency_key,correlation_id:p.correlation_id,
   payload:{lease_id:lease.resource_id,environment:lease.environment}};
  identityProvisioningFinalizationRpc(request,scope);
  const finalize=async()=>{
   const result=await finalizer.finalize(request);
   if(result.request_id!==lease.request_id||result.generation!==lease.generation)throw new DomainError('VALIDATION_ERROR');
   return result;
  };
  // This supports historical replay without requiring an expired/completed lease.
  // A missing reserved subject is PERMISSION_DENIED; a fresh lease check below must
  // independently prove authority before any privileged Auth read or write.
  try{return await finalize();}
  catch(error){if(!(error instanceof DomainError)||error.code!=='PERMISSION_DENIED')throw error;}
  try{
  let identity=await leases.check(lease);
  if(!await admin.find(identity)){
   identity=await leases.check(lease); // Auth lookup may have waited; recheck before create.
   try{await admin.create(identity);}
   catch{
    // A timed-out POST may have committed. Only reconcile the SAME reserved UUID.
    // Never retry creation here, search by email, rewrite metadata or delete a user.
    identity=await leases.check(lease);
    if(!await admin.find(identity))throw new DomainError('INTERNAL_ERROR');
   }
  }
  }catch(error){
   // Another request can complete between our RPCs. Ask the canonical finalizer
   // for this exact key's receipt; never resume privileged work from a stale lease.
   if(error instanceof DomainError&&error.code==='INVALID_STATE_TRANSITION')return finalize();
   throw error;
  }
  return finalize(); // Rechecks current lease and atomic canonical enrollment.
 }});
}
