import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from './impact-core.mjs';
const config={highFiles:['package.json','AGENTS.md'],highPrefixes:['packages/domain/','packages/kernel/','supabase/','infra/','scripts/quality/','.github/workflows/']};
const baseIndex={imports:[],packages:[],coverage:{mode:'syntactic-conservative',unknowns:[]}};
test('canonical/RPC-only changes still demand real SQL contracts and concurrency',()=>{
 for(const file of ['packages/api-contracts/src/rpc.ts','packages/api-contracts/src/connect-registry.ts','packages/domain/src/connect.ts','packages/events/src/index.ts','packages/kernel/src/connection-routing.ts','scripts/database/check-connect-routes.mjs']) {
  const result=analyze({files:[file],dirty:false},baseIndex,config);
  assert(result.requiredChecks.includes('database-replay-and-rls'),file);
  assert(result.requiredChecks.includes('rpc-contract-and-concurrency-tests'),file);
 }
});
test('a SQL proposal is never reported as a replayed tracked migration',()=>{
 const result=analyze({files:['supabase/proposals/phase0_connect_registry.sql'],dirty:false},baseIndex,config);
 assert(result.requiredChecks.includes('proposal-materialization-and-postgres-tests'));
 assert(result.requiredChecks.includes('database-replay-and-rls'));
});
