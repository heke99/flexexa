import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tenantId, entityId } from '../../packages/domain/src/index.ts';
import { connectEnvironment, parseConnectionRoute } from '../../packages/domain/src/connect.ts';
// Receives actual authenticated SQL output from the disposable database runner.
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const scope = {tenant_id:tenantId(input.scope.tenant_id), asset_id:entityId(input.scope.asset_id), environment:connectEnvironment(input.scope.environment)};
assert.equal(scope.environment, 'sandbox');
assert.equal(input.routes.length, 2);
const routes = input.routes.map(route => parseConnectionRoute(route, scope));
assert.deepEqual(routes.map(route => route.provider_key).sort(), ['enode', 'ocpp']);
for (const route of routes) {
  assert.equal(route.environment, 'sandbox');
  assert.equal(route.state_observed_at, '2026-09-09T11:00:00.000Z');
  assert.equal(route.account_status, 'connected');
  assert.equal(route.provider_status, 'active');
  assert.equal(route.connection_status, 'connected');
  assert.deepEqual(route.capabilities, ['read_soc']);
  assert(!Object.hasOwn(route, 'credential_reference'));
  assert.throws(() => parseConnectionRoute({...route, environment:'production'}, scope), {code:'PERMISSION_DENIED'});
}
console.log(JSON.stringify({authenticated_sql_routes_validated:routes.length, providers:['enode','ocpp'], environment:'sandbox'}));
