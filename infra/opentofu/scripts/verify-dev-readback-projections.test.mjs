import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expectedResources, verifyDevPlan } from './verify-dev-plan.mjs';

// Synthetic rejection tests model the exact observed first-apply projections.
// Only the real read-only AWS plan/authorized apply are cloud evidence.
function fixture() {
  const provider_name = 'registry.opentofu.org/hashicorp/aws';
  const resources = [...expectedResources()].map(([address, values]) => ({
    address, mode: 'managed', type: address.split('.')[2], provider_name,
    values: { ...structuredClone(values), region: 'eu-north-1' },
  }));
  const get = (suffix) => resources.find((r) => r.address === `module.foundation.${suffix}`).values;
  for (const resource of resources) {
    if (resource.type === 'aws_ecr_lifecycle_policy') resource.values.policy = JSON.stringify({ rules: [{
      rulePriority: 1, selection: { tagStatus: 'untagged', countType: 'sinceImagePushed', countUnit: 'days', countNumber: 14 }, action: { type: 'expire' },
    }] });
  }
  const vpc = 'vpc-11111111111111111'; const gateway = 'igw-22222222222222222'; const table = 'rtb-33333333333333333';
  Object.assign(get('aws_vpc.this'), { id: vpc, owner_id: '938095765653' });
  Object.assign(get('aws_internet_gateway.this'), { id: gateway, vpc_id: vpc, owner_id: '938095765653' });
  Object.assign(get('aws_route_table.public'), { id: table, vpc_id: vpc, owner_id: '938095765653', route: [{ cidr_block: '0.0.0.0/0', gateway_id: gateway, nat_gateway_id: '', ipv6_cidr_block: '' }] });
  Object.assign(get('aws_route.public_internet'), { route_table_id: table, gateway_id: gateway, state: 'active', origin: 'CreateRoute' });
  for (const purpose of ['raw', 'audit', 'settlement']) {
    const bucket = `flexexa-dev-${purpose}-938095765653`;
    Object.assign(get(`aws_s3_bucket.storage["${purpose}"]`), { id: bucket, versioning: [{ enabled: true, mfa_delete: false }] });
    Object.assign(get(`aws_s3_bucket_versioning.storage["${purpose}"]`), { id: bucket, bucket, versioning_configuration: [{ status: 'Enabled', mfa_delete: 'Disabled' }] });
  }
  const changes = resources.map((r) => ({ address: r.address, type: r.type, mode: r.mode, provider_name,
    change: { actions: ['no-op'], before: structuredClone(r.values), after: structuredClone(r.values), after_unknown: {} },
  }));
  const drift = changes.filter((r) => r.type === 'aws_s3_bucket' || r.address === 'module.foundation.aws_route_table.public').map((r) => {
    const entry = structuredClone(r); entry.change.actions = ['update'];
    if (r.type === 'aws_s3_bucket') entry.change.before.versioning = [{ enabled: false, mfa_delete: false }];
    else entry.change.before.route = [];
    return entry;
  });
  return { format_version: '1.2', complete: true, errored: false,
    variables: { aws_region: { value: 'eu-north-1' }, environment: { value: 'dev' }, project: { value: 'flexexa' }, github_repository: { value: 'heke99/flexexa' } },
    planned_values: { outputs: { aws_account_id: { value: '938095765653' }, aws_region: { value: 'eu-north-1' }, environment: { value: 'dev' } }, root_module: { child_modules: [{ resources }] } },
    resource_changes: changes, resource_drift: drift,
  };
}
const drift = (p, type = 'aws_s3_bucket') => p.resource_drift.find((r) => r.type === type);
const change = (p, type) => p.resource_changes.find((r) => r.type === type);
function consistentMutation(p, type, fn) {
  const entry = change(p, type); fn(entry.change.after); entry.change.before = structuredClone(entry.change.after);
  const resource = p.planned_values.root_module.child_modules[0].resources.find((r) => r.address === entry.address);
  resource.values = structuredClone(entry.change.after);
}

test('accepts exactly the observed four projections with 52 unchanged resources', () => {
  const result = verifyDevPlan(fixture(), { requireNoop: true });
  assert.equal(result.reviewedReadbackProjections, 4);
  assert.equal(result.noOp, 52); assert.equal(result.create, 0); assert.equal(result.destroy, 0);
});
test('accepts any reviewed subset, including already converged state', () => {
  for (let count = 0; count <= 4; count++) {
    const p = fixture(); p.resource_drift = p.resource_drift.slice(0, count);
    assert.equal(verifyDevPlan(p).reviewedReadbackProjections, count);
  }
});
test('strict post-apply gate refuses even reviewed unpersisted projections', () => {
  assert.throws(() => verifyDevPlan(fixture(), { requireConverged: true }), /has not converged/);
  const p = fixture(); p.resource_drift = [];
  assert.equal(verifyDevPlan(p, { requireConverged: true }).reviewedReadbackProjections, 0);
});
const negative = [
  ['malformed drift', (p) => { p.resource_drift = {}; }],
  ['null drift', (p) => { p.resource_drift = null; }],
  ['malformed drift entry', (p) => { p.resource_drift = [null]; }],
  ['unknown drift address', (p) => { drift(p).address = 'NEVER_LOG_SECRET'; }],
  ['duplicate drift', (p) => { p.resource_drift = [drift(p), drift(p)]; }],
  ['fifth drift', (p) => { p.resource_drift.push(drift(p)); }],
  ['wrong provider', (p) => { drift(p).provider_name = 'other/provider'; }],
  ['wrong type', (p) => { drift(p).type = 'aws_iam_role'; }],
  ['data drift', (p) => { drift(p).mode = 'data'; }],
  ['drift import', (p) => { drift(p).change.importing = { id: 'other' }; }],
  ['drift move', (p) => { drift(p).previous_address = 'other'; }],
  ['drift delete', (p) => { drift(p).change.actions = ['delete']; }],
  ['drift replacement', (p) => { drift(p).change.actions = ['delete', 'create']; }],
  ['drift unknown', (p) => { drift(p).change.after_unknown = { versioning: true }; }],
  ['null prior state', (p) => { drift(p).change.before = null; }],
  ['missing projected key', (p) => { delete drift(p).change.before.versioning; }],
  ['extra prior key', (p) => { drift(p).change.before.extra = true; }],
  ['extra field change', (p) => { drift(p).change.before.force_destroy = true; }],
  ['unchanged projection', (p) => { drift(p).change.before = structuredClone(drift(p).change.after); }],
  ['unobserved initial versioning shape', (p) => { drift(p).change.before.versioning = []; }],
  ['MFA deletion change', (p) => { drift(p).change.before.versioning[0].mfa_delete = true; }],
  ['after differs from plan', (p) => { drift(p).change.after.versioning[0].enabled = false; }],
  ['unrelated creation', (p) => { change(p, 'aws_ecs_cluster').change.actions = ['create']; }],
  ['unrelated update', (p) => { change(p, 'aws_ecs_cluster').change.actions = ['update']; }],
  ['unrelated delete', (p) => { change(p, 'aws_ecs_cluster').change.actions = ['delete']; }],
  ['inconsistent no-op', (p) => { change(p, 'aws_ecs_cluster').change.before.name = 'other'; }],
  ['unknown no-op value', (p) => { change(p, 'aws_ecs_cluster').change.after_unknown = { name: true }; }],
  ['owner missing', (p) => { p.resource_changes = p.resource_changes.filter((r) => r.type !== 'aws_s3_bucket_versioning'); }],
  ['versioning owner wrong bucket', (p) => { consistentMutation(p, 'aws_s3_bucket_versioning', (v) => { v.bucket = 'other'; }); }],
  ['versioning owner suspended', (p) => { consistentMutation(p, 'aws_s3_bucket_versioning', (v) => { v.versioning_configuration[0].status = 'Suspended'; }); }],
  ['owner wrong region', (p) => { consistentMutation(p, 'aws_s3_bucket_versioning', (v) => { v.region = 'us-east-1'; }); }],
  ['owner not in planned parity', (p) => { change(p, 'aws_s3_bucket_versioning').change.after.id = 'other'; }],
  ['nonempty initial route', (p) => { drift(p, 'aws_route_table').change.before.route = [{ cidr_block: '10.0.0.0/8' }]; }],
  ['route owner wrong table', (p) => { consistentMutation(p, 'aws_route', (v) => { v.route_table_id = 'rtb-44444444444444444'; }); }],
  ['route wrong gateway', (p) => { consistentMutation(p, 'aws_route', (v) => { v.gateway_id = 'igw-44444444444444444'; }); }],
  ['route blackhole', (p) => { consistentMutation(p, 'aws_route', (v) => { v.state = 'blackhole'; }); }],
  ['gateway wrong VPC', (p) => { consistentMutation(p, 'aws_internet_gateway', (v) => { v.vpc_id = 'vpc-44444444444444444'; }); }],
  ['gateway wrong account', (p) => { consistentMutation(p, 'aws_internet_gateway', (v) => { v.owner_id = '111111111111'; }); }],
  ['wrong CIDR', (p) => { consistentMutation(p, 'aws_route', (v) => { v.destination_cidr_block = '10.0.0.0/8'; }); }],
];
for (const [name, mutate] of negative) test(`rejects ${name}`, () => {
  const p = fixture(); mutate(p); assert.throws(() => verifyDevPlan(p), /DEV_FOUNDATION_PLAN_REJECTED/);
});
for (const [name, fn] of [
  ['second route', (v) => v.route.push({ ...v.route[0] })],
  ['alternate target', (v) => { v.route[0].nat_gateway_id = 'nat-44444444444444444'; }],
  ['unknown route attribute', (v) => { v.route[0].unreviewed = ''; }],
  ['route projection wrong gateway', (v) => { v.route[0].gateway_id = 'igw-44444444444444444'; }],
]) test(`rejects internally consistent but unsafe ${name}`, () => {
  const p = fixture(); consistentMutation(p, 'aws_route_table', fn);
  drift(p, 'aws_route_table').change.after = structuredClone(change(p, 'aws_route_table').change.after);
  assert.throws(() => verifyDevPlan(p), /DEV_FOUNDATION_PLAN_REJECTED/);
});
test('strict modes never allow new infrastructure even without drift', () => {
  const p = fixture(); p.resource_drift = []; change(p, 'aws_ecs_cluster').change.actions = ['create'];
  for (const options of [{ requireNoop: true }, { requireConverged: true }]) assert.throws(() => verifyDevPlan(p, options), /every resource to be no-op/);
});
test('CLI enforces modes and never reflects malformed JSON contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flexexa-readback-'));
  const cli = fileURLToPath(new URL('./verify-dev-plan.mjs', import.meta.url));
  const input = join(dir, 'plan.json'); const output = join(dir, 'summary.json');
  try {
    writeFileSync(input, JSON.stringify(fixture()));
    const run = (...flags) => spawnSync(process.execPath, [cli, input, output, ...flags], { encoding: 'utf8' });
    assert.equal(run('--require-converged').status, 1);
    assert.equal(run('--not-a-mode').status, 1);
    assert.equal(run('--require-noop').status, 0);
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).reviewedReadbackProjections, 4);
    rmSync(output); writeFileSync(input, '{"NEVER_LOG_SECRET": unquoted}');
    const result = run(); assert.equal(result.status, 1);
    assert.ok(!`${result.stdout}${result.stderr}`.includes('NEVER_LOG_SECRET'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
