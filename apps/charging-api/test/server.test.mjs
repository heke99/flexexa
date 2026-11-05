import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {DomainError} from '@flexexa/domain';
import {createChargingReadServer} from '../src/server.ts';
const a='f7000000-0000-4000-8000-000000000001',b='f7000000-0000-4000-8000-000000000002';
const row={tenant_id:a,generated_at:'2026-11-05T12:00:00Z',mode:'simulation',assets:[]};
async function fixture(t,extra={}){
 let audits=0;
 const backend={
  async company(token,tenant){if(token!=='company-token-a'||tenant!==a)throw new DomainError('PERMISSION_DENIED');return row;},
  async platformAudited(token){if(token!=='platform-token')throw new DomainError('PERMISSION_DENIED');audits++;return {generated_at:row.generated_at,mode:'simulation',companies:[]};},...extra};
 const server=createChargingReadServer(backend);server.listen(0,'127.0.0.1');await once(server,'listening');
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const call=(path,token,options={})=>fetch(`http://127.0.0.1:${server.address().port}${path}`,{...options,headers:token?{authorization:`Bearer ${token}`}:{}});
 return {call,audits:()=>audits};
}
test('HTTP company reads are no-store and scoped',async t=>{const {call}=await fixture(t);const r=await call(`/v1/companies/${a}/charging-overview`,'company-token-a');assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).tenant_id,a);});
test('missing token denied before backend',async t=>{const {call}=await fixture(t);assert.equal((await call(`/v1/companies/${a}/charging-overview`)).status,401);});
test('company A cannot read company B',async t=>{const {call}=await fixture(t);assert.equal((await call(`/v1/companies/${b}/charging-overview`,'company-token-a')).status,403);});
test('company token cannot enter platform path or create audit',async t=>{const f=await fixture(t);assert.equal((await f.call('/v1/platform/charging-overview','company-token-a')).status,403);assert.equal(f.audits(),0);});
test('platform path awaits privileged audited adapter',async t=>{const f=await fixture(t);assert.equal((await f.call('/v1/platform/charging-overview','platform-token')).status,200);assert.equal(f.audits(),1);});
test('cross-tenant backend response rejected',async t=>{const {call}=await fixture(t,{company:async()=>({...row,tenant_id:b})});assert.equal((await call(`/v1/companies/${a}/charging-overview`,'company-token-a')).status,403);});
test('invalid or leaking backend fields fail closed',async t=>{const {call}=await fixture(t,{company:async()=>({...row,provider_token:'must-not-leak'})});const r=await call(`/v1/companies/${a}/charging-overview`,'company-token-a');assert.equal(r.status,502);assert.equal((await r.text()).includes('must-not-leak'),false);});
test('no mutation endpoint or query tenant override',async t=>{const {call}=await fixture(t);assert.equal((await call(`/v1/companies/${a}/charging-overview`,'company-token-a',{method:'POST'})).status,405);assert.equal((await call(`/v1/companies/${a}/charging-overview?tenant_id=${b}`,'company-token-a')).status,404);});
test('audit failure returns no platform data',async t=>{const {call}=await fixture(t,{platformAudited:async()=>{throw new Error('audit-unavailable');}});assert.equal((await call('/v1/platform/charging-overview','platform-token')).status,502);});
