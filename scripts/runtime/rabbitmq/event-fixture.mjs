import {ensureSourceWorkspace} from '../../database/source-workspace.mjs';
ensureSourceWorkspace();
const {parseTenantEvent}=await import('../../../packages/events/src/index.ts');
const {tenantId}=await import('../../../packages/domain/src/index.ts');
const tenant='cb000000-0000-4000-8000-000000000001';
console.log(JSON.stringify(parseTenantEvent({event_id:'cb000000-0000-4000-8000-000000000010',event_type:'asset.connected',event_version:1,
 occurred_at:'2026-09-10T00:00:00Z',received_at:'2026-09-10T00:00:00Z',tenant_id:tenant,organization_id:null,
 correlation_id:'cb000000-0000-4000-8000-000000000020',causation_id:null,source:'runtime-fixture',payload:{asset_id:'cb000000-0000-4000-8000-000000000030'}},tenantId(tenant))));
