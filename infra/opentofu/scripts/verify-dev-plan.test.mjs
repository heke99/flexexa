import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expectedResources, verifyDevPlan } from './verify-dev-plan.mjs';

// Synthetic inputs exercise rejection behavior. Only a real OpenTofu/AWS plan
// executed in the OIDC workflow is infrastructure evidence.
function fixture() {
  const provider_name = 'registry.opentofu.org/hashicorp/aws';
  const managed = [...expectedResources()].map(([address, values]) => ({
    address, mode: 'managed', type: address.split('.')[2], provider_name, values: structuredClone(values),
  }));
  for (const resource of managed) {
    if (resource.type === 'aws_ecr_lifecycle_policy') resource.values.policy = JSON.stringify({ rules: [{
      rulePriority: 1,
      description: 'Expire untagged development images after 14 days',
      selection: { tagStatus: 'untagged', countType: 'sinceImagePushed', countUnit: 'days', countNumber: 14 },
      action: { type: 'expire' },
    }] });
  }
  return {
    format_version: '1.2', errored: false, complete: true,
    variables: { aws_region: { value: 'eu-north-1' }, environment: { value: 'dev' }, project: { value: 'flexexa' }, github_repository: { value: 'heke99/flexexa' } },
    planned_values: { outputs: { aws_account_id: { value: '938095765653' }, aws_region: { value: 'eu-north-1' }, environment: { value: 'dev' } }, root_module: {
      resources: [
        ['data.aws_caller_identity.current', { account_id: '938095765653' }],
        ['data.aws_region.current', { name: 'eu-north-1' }],
        ['data.aws_availability_zones.available', { names: ['eu-north-1a', 'eu-north-1b', 'eu-north-1c'] }],
      ].map(([address, values]) => ({ address, mode: 'data', type: address.split('.')[1], provider_name, values })),
      child_modules: [{ address: 'module.foundation', resources: managed }],
    } },
    resource_changes: managed.map((resource) => ({
      address: resource.address, mode: resource.mode, type: resource.type, provider_name,
      change: { actions: ['create'], before: null, after: structuredClone(resource.values), after_unknown: {} },
    })),
  };
}
const resources = (plan) => plan.planned_values.root_module.child_modules[0].resources;
const changed = (plan, type) => plan.resource_changes.find((entry) => entry.type === type);
const value = (plan, type) => resources(plan).find((entry) => entry.type === type).values;

for (const [label, mode] of [['empty AWS development foundation', 'create'], ['already applied foundation', 'no-op'], ['partial first-apply recovery', 'partial']]) {
  test(`accepts ${label} without authorizing update/delete`, () => {
    const plan = fixture();
    if (mode !== 'create') plan.resource_changes.forEach((entry, index) => { entry.change.actions = [mode === 'no-op' || index % 2 === 0 ? 'no-op' : 'create']; });
    const result = verifyDevPlan(plan);
    assert.equal(result.managedResources, 52);
    assert.equal(result.create + result.noOp, 52);
    assert.equal(result.update, 0);
    assert.equal(result.destroy, 0);
  });
}

test('manifest has exactly the reviewed resource distribution', () => {
  const counts = {};
  for (const address of expectedResources().keys()) { const type = address.split('.')[2]; counts[type] = (counts[type] ?? 0) + 1; }
  assert.deepEqual(counts, {
    aws_vpc: 1, aws_internet_gateway: 1, aws_route_table: 3, aws_route: 1, aws_subnet: 4,
    aws_route_table_association: 4, aws_vpc_endpoint: 1, aws_ecs_cluster: 1,
    aws_ecr_repository: 7, aws_ecr_lifecycle_policy: 7, aws_cloudwatch_log_group: 7,
    aws_s3_bucket: 3, aws_s3_bucket_versioning: 3, aws_s3_bucket_server_side_encryption_configuration: 3,
    aws_s3_bucket_public_access_block: 3, aws_s3_bucket_ownership_controls: 3,
  });
});

const negative = [
  ['unsupported JSON major', (p) => { p.format_version = '2.0'; }],
  ['missing JSON format', (p) => { delete p.format_version; }],
  ['errored plan', (p) => { p.errored = true; }],
  ['incomplete plan', (p) => { p.complete = false; }],
  ['deferred resources', (p) => { p.deferred_changes = [{}]; }],
  ['malformed deferred resources', (p) => { p.deferred_changes = {}; }],
  ['unreviewed drift', (p) => { p.resource_drift = [{}]; }],
  ['malformed drift', (p) => { p.resource_drift = {}; }],
  ['failed checks', (p) => { p.checks = [{ status: 'fail' }]; }],
  ['unknown checks', (p) => { p.checks = [{ status: 'unknown' }]; }],
  ['malformed checks', (p) => { p.checks = {}; }],
  ['wrong account', (p) => { p.planned_values.root_module.resources[0].values.account_id = '111111111111'; }],
  ['missing identity', (p) => { p.planned_values.root_module.resources.shift(); delete p.planned_values.outputs.aws_account_id; }],
  ['wrong actual region', (p) => { p.planned_values.root_module.resources[1].values.name = 'us-east-1'; }],
  ['wrong AZ selection', (p) => { p.planned_values.root_module.resources[2].values.names.reverse(); }],
  ['wrong configured region', (p) => { p.variables.aws_region.value = 'eu-west-1'; }],
  ['production environment', (p) => { p.variables.environment.value = 'production'; }],
  ['wrong project', (p) => { p.variables.project.value = 'other'; }],
  ['wrong repository', (p) => { p.variables.github_repository.value = 'other/project'; }],
  ['missing variables', (p) => { delete p.variables; }],
  ['missing root module', (p) => { delete p.planned_values.root_module; }],
  ['malformed module resources', (p) => { p.planned_values.root_module.resources = {}; }],
  ['malformed child modules', (p) => { p.planned_values.root_module.child_modules = {}; }],
  ['missing planned resource', (p) => { resources(p).pop(); }],
  ['duplicated planned resource', (p) => { resources(p).push(structuredClone(resources(p)[0])); }],
  ['unreviewed planned resource', (p) => { resources(p)[0].address = 'module.foundation.aws_iam_user.root'; }],
  ['unreviewed data resource', (p) => { p.planned_values.root_module.resources[0].address = 'data.aws_secretsmanager_secret_version.credential'; }],
  ['wrong planned provider', (p) => { resources(p)[0].provider_name = 'example/unsafe'; }],
  ['wrong planned type', (p) => { resources(p)[0].type = 'aws_iam_user'; }],
  ['missing changes', (p) => { delete p.resource_changes; }],
  ['missing managed change', (p) => { p.resource_changes.pop(); }],
  ['duplicate managed change', (p) => { p.resource_changes.push(structuredClone(p.resource_changes[0])); }],
  ['unreviewed managed change', (p) => { p.resource_changes[0].address = 'module.foundation.aws_nat_gateway.unreviewed'; }],
  ['wrong change provider', (p) => { p.resource_changes[0].provider_name = 'example/unsafe'; }],
  ['wrong change type', (p) => { p.resource_changes[0].type = 'aws_iam_user'; }],
  ['update', (p) => { p.resource_changes[0].change.actions = ['update']; }],
  ['delete', (p) => { p.resource_changes[0].change.actions = ['delete']; }],
  ['replacement', (p) => { p.resource_changes[0].change.actions = ['delete', 'create']; }],
  ['create-before-destroy', (p) => { p.resource_changes[0].change.actions = ['create', 'delete']; }],
  ['empty actions', (p) => { p.resource_changes[0].change.actions = []; }],
  ['missing actions', (p) => { delete p.resource_changes[0].change.actions; }],
  ['import', (p) => { p.resource_changes[0].change.importing = { id: 'vpc-unreviewed' }; }],
  ['move', (p) => { p.resource_changes[0].previous_address = 'aws_vpc.other'; }],
  ['wrong VPC CIDR', (p) => { value(p, 'aws_vpc').cidr_block = '172.16.0.0/16'; }],
  ['missing security-sensitive value', (p) => { delete value(p, 'aws_vpc').enable_dns_support; }],
  ['public subnet IP assignment', (p) => { value(p, 'aws_subnet').map_public_ip_on_launch = true; }],
  ['wrong AWS tag scope', (p) => { value(p, 'aws_vpc').tags_all.Environment = 'prod'; }],
  ['wrong storage account/name', (p) => { value(p, 'aws_s3_bucket').bucket = 'other'; }],
  ['forced storage destruction', (p) => { value(p, 'aws_s3_bucket').force_destroy = true; }],
  ['suspended versioning', (p) => { value(p, 'aws_s3_bucket_versioning').versioning_configuration[0].status = 'Suspended'; }],
  ['weakened public access block', (p) => { value(p, 'aws_s3_bucket_public_access_block').block_public_policy = false; }],
  ['removed encryption', (p) => { value(p, 'aws_s3_bucket_server_side_encryption_configuration').rule = []; }],
  ['mutable image tags', (p) => { value(p, 'aws_ecr_repository').image_tag_mutability = 'MUTABLE'; }],
  ['disabled image scanning', (p) => { value(p, 'aws_ecr_repository').image_scanning_configuration[0].scan_on_push = false; }],
  ['wrong log retention', (p) => { value(p, 'aws_cloudwatch_log_group').retention_in_days = 0; }],
  ['disabled ECS insights', (p) => { value(p, 'aws_ecs_cluster').setting[0].value = 'disabled'; }],
  ['wrong S3 endpoint region', (p) => { value(p, 'aws_vpc_endpoint').service_name = 'com.amazonaws.us-east-1.s3'; }],
  ['invalid lifecycle JSON', (p) => { value(p, 'aws_ecr_lifecycle_policy').policy = '!'; }],
  ['lifecycle deleting tagged rollback images', (p) => { const v = value(p, 'aws_ecr_lifecycle_policy'); const policy = JSON.parse(v.policy); policy.rules[0].selection.tagStatus = 'any'; v.policy = JSON.stringify(policy); }],
  ['unsafe after values despite safe planned values', (p) => { changed(p, 'aws_ecr_repository').change.after.image_tag_mutability = 'MUTABLE'; }],
];
for (const [name, mutate] of negative) test(`rejects ${name}`, () => { const plan = fixture(); mutate(plan); assert.throws(() => verifyDevPlan(plan), /DEV_FOUNDATION_PLAN_REJECTED/); });
for (const plan of [null, [], 1, 'invalid']) test(`rejects non-object ${JSON.stringify(plan)}`, () => assert.throws(() => verifyDevPlan(plan), /DEV_FOUNDATION_PLAN_REJECTED/));

test('accepts successful checks and the compatible AWS registry identity', () => {
  const plan = fixture(); plan.checks = [{ status: 'pass' }]; plan.deferred_changes = []; plan.resource_drift = [];
  for (const resource of [...resources(plan), ...plan.planned_values.root_module.resources, ...plan.resource_changes]) resource.provider_name = 'registry.terraform.io/hashicorp/aws';
  assert.equal(verifyDevPlan(plan).status, 'passed');
});

test('CLI emits only a sanitized summary; malformed JSON and existing output fail', () => {
  const directory = mkdtempSync(join(tmpdir(), 'flexexa-plan-test-'));
  const executable = fileURLToPath(new URL('./verify-dev-plan.mjs', import.meta.url));
  const input = join(directory, 'plan.json'); const output = join(directory, 'summary.json');
  try {
    writeFileSync(input, JSON.stringify(fixture()));
    const good = spawnSync(process.execPath, [executable, input, output], { encoding: 'utf8' });
    assert.equal(good.status, 0, good.stderr);
    const text = readFileSync(output, 'utf8');
    assert.equal(JSON.parse(text).create, 52);
    assert.ok(!text.includes('resource_changes'));
    assert.equal(spawnSync(process.execPath, [executable, input, output]).status, 1);
    rmSync(output);
    writeFileSync(input, '{invalid');
    assert.equal(spawnSync(process.execPath, [executable, input, output]).status, 1);
    assert.equal(spawnSync(process.execPath, [executable]).status, 1);
  } finally { rmSync(directory, { force: true, recursive: true }); }
});


test('accepts the observed OpenTofu shape with elided data-source resources', () => {
  const plan = fixture();
  plan.planned_values.root_module.resources = [];
  assert.equal(verifyDevPlan(plan).create, 52);
});
for (const [field, invalid] of [['aws_account_id', '111111111111'], ['aws_region', 'us-east-1'], ['environment', 'prod']]) {
  test(`rejects contradictory ${field} output even with valid data sources`, () => {
    const plan = fixture(); plan.planned_values.outputs[field].value = invalid;
    assert.throws(() => verifyDevPlan(plan), /DEV_FOUNDATION_PLAN_REJECTED/);
  });
  test(`rejects missing ${field} output when data sources are elided`, () => {
    const plan = fixture(); plan.planned_values.root_module.resources = [];
    delete plan.planned_values.outputs[field];
    assert.throws(() => verifyDevPlan(plan), /DEV_FOUNDATION_PLAN_REJECTED/);
  });
}
