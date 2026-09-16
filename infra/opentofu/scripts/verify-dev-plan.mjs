import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// This is an intentionally narrow first-foundation gate, not a general apply policy.
// Expanding this manifest requires review; updates, imports and destroys fail closed.
export const authority = Object.freeze({
  accountId: '938095765653',
  region: 'eu-north-1',
  project: 'flexexa',
  environment: 'dev',
});
const zones = ['eu-north-1a', 'eu-north-1b'];
const services = ['api', 'connector', 'control', 'optimizer', 'flex', 'settlement', 'workers'];
const purposes = ['raw', 'audit', 'settlement'];
const providers = new Set(['registry.opentofu.org/hashicorp/aws', 'registry.terraform.io/hashicorp/aws']);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const reject = (message) => { throw new Error(`DEV_FOUNDATION_PLAN_REJECTED: ${message}`); };

function subset(actual, expected, path) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) reject(`${path}: unexpected list`);
    expected.forEach((value, index) => subset(actual[index], value, `${path}[${index}]`));
  } else if (object(expected)) {
    if (!object(actual)) reject(`${path}: missing object`);
    for (const [key, value] of Object.entries(expected)) {
      if (!own(actual, key)) reject(`${path}.${key}: missing value`);
      subset(actual[key], value, `${path}.${key}`);
    }
  } else if (actual !== expected) {
    reject(`${path}: unexpected value`);
  }
}

export function expectedResources() {
  const expected = new Map();
  const tags = { Project: 'flexexa', Environment: 'dev', ManagedBy: 'opentofu' };
  const add = (suffix, values) => expected.set(`module.foundation.${suffix}`, values);
  const tagged = (values) => ({ ...values, tags_all: { ...tags } });
  add('aws_vpc.this', tagged({ cidr_block: '10.40.0.0/16', enable_dns_support: true, enable_dns_hostnames: true }));
  add('aws_internet_gateway.this', tagged({ tags: { Name: 'flexexa-dev-igw' } }));
  add('aws_route_table.public', tagged({ tags: { Name: 'flexexa-dev-public' } }));
  add('aws_route.public_internet', { destination_cidr_block: '0.0.0.0/0' });
  for (const [index, zone] of zones.entries()) {
    for (const tier of ['public', 'private']) {
      add(`aws_subnet.${tier}["${zone}"]`, tagged({
        availability_zone: zone,
        cidr_block: `10.40.${index + (tier === 'private' ? 10 : 0)}.0/24`,
        map_public_ip_on_launch: false,
        tags: { Tier: tier, Name: `flexexa-dev-${tier}-${zone}` },
      }));
      add(`aws_route_table_association.${tier}["${zone}"]`, {});
    }
    add(`aws_route_table.private["${zone}"]`, tagged({ tags: { Name: `flexexa-dev-private-${zone}` } }));
  }
  add('aws_vpc_endpoint.s3', tagged({ vpc_endpoint_type: 'Gateway', service_name: 'com.amazonaws.eu-north-1.s3' }));
  add('aws_ecs_cluster.this', tagged({ name: 'flexexa-dev', setting: [{ name: 'containerInsights', value: 'enabled' }] }));
  for (const service of services) {
    add(`aws_ecr_repository.service["${service}"]`, tagged({
      name: `flexexa/dev/${service}`,
      image_tag_mutability: 'IMMUTABLE',
      force_delete: false,
      encryption_configuration: [{ encryption_type: 'AES256' }],
      image_scanning_configuration: [{ scan_on_push: true }],
    }));
    add(`aws_ecr_lifecycle_policy.service["${service}"]`, { repository: `flexexa/dev/${service}` });
    add(`aws_cloudwatch_log_group.service["${service}"]`, tagged({ name: `/flexexa/dev/${service}`, retention_in_days: 30 }));
  }
  for (const purpose of purposes) {
    add(`aws_s3_bucket.storage["${purpose}"]`, tagged({ bucket: `flexexa-dev-${purpose}-938095765653`, force_destroy: false }));
    add(`aws_s3_bucket_versioning.storage["${purpose}"]`, { versioning_configuration: [{ status: 'Enabled' }] });
    add(`aws_s3_bucket_server_side_encryption_configuration.storage["${purpose}"]`, {
      rule: [{ apply_server_side_encryption_by_default: [{ sse_algorithm: 'AES256' }] }],
    });
    add(`aws_s3_bucket_public_access_block.storage["${purpose}"]`, {
      block_public_acls: true, block_public_policy: true, ignore_public_acls: true, restrict_public_buckets: true,
    });
    add(`aws_s3_bucket_ownership_controls.storage["${purpose}"]`, { rule: [{ object_ownership: 'BucketOwnerEnforced' }] });
  }
  return expected;
}

function flattenedResources(module) {
  if (!object(module)) reject('planned root module missing');
  const result = [];
  const visit = (current) => {
    if (!object(current) || (own(current, 'resources') && !Array.isArray(current.resources))
      || (own(current, 'child_modules') && !Array.isArray(current.child_modules))) reject('malformed planned module');
    result.push(...(current.resources ?? []));
    for (const child of current.child_modules ?? []) visit(child);
  };
  visit(module);
  return result;
}

function checkValues(resource, expected) {
  subset(resource.values, expected, resource.address);
  if (resource.type === 'aws_ecr_lifecycle_policy') {
    let policy;
    try { policy = JSON.parse(resource.values.policy); } catch { reject(`${resource.address}: invalid lifecycle policy`); }
    subset(policy, { rules: [{
      rulePriority: 1,
      selection: { tagStatus: 'untagged', countType: 'sinceImagePushed', countUnit: 'days', countNumber: 14 },
      action: { type: 'expire' },
    }] }, `${resource.address}.policy`);
  }
}

export function verifyDevPlan(plan) {
  if (!object(plan) || typeof plan.format_version !== 'string' || !/^1\.[0-9]+$/.test(plan.format_version)) reject('unsupported plan JSON format');
  if (plan.errored === true || plan.complete === false) reject('errored or incomplete plan');
  if (own(plan, 'deferred_changes') && (!Array.isArray(plan.deferred_changes) || plan.deferred_changes.length !== 0)) reject('deferred changes');
  if (own(plan, 'resource_drift') && (!Array.isArray(plan.resource_drift) || plan.resource_drift.length !== 0)) reject('unreviewed resource drift');
  if (own(plan, 'checks')) {
    if (!Array.isArray(plan.checks) || plan.checks.some((check) => !object(check) || check.status !== 'pass')) reject('failed or unresolved checks');
  }
  for (const [key, value] of Object.entries({ aws_region: authority.region, environment: authority.environment, project: authority.project, github_repository: 'heke99/flexexa' })) {
    subset(plan.variables?.[key], { value }, `variables.${key}`);
  }
  const resources = flattenedResources(plan.planned_values?.root_module);
  const expected = expectedResources();
  const seen = new Set();
  const data = new Map();
  const allowedData = new Set(['data.aws_caller_identity.current', 'data.aws_region.current', 'data.aws_availability_zones.available']);
  for (const resource of resources) {
    if (!object(resource) || typeof resource.address !== 'string' || seen.has(resource.address)) reject('malformed or duplicate planned resource');
    seen.add(resource.address);
    if (!providers.has(resource.provider_name)) reject(`${resource.address}: unreviewed provider`);
    if (resource.mode === 'data' && allowedData.has(resource.address)) {
      data.set(resource.address, resource.values);
      continue;
    }
    if (resource.mode !== 'managed' || !expected.has(resource.address)) reject(`${resource.address}: unreviewed resource`);
    const type = resource.address.split('.')[2];
    if (resource.type !== type) reject(`${resource.address}: type mismatch`);
    checkValues(resource, expected.get(resource.address));
  }
  subset(data.get('data.aws_caller_identity.current'), { account_id: authority.accountId }, 'AWS identity');
  const region = data.get('data.aws_region.current');
  if (!object(region) || (region.name ?? region.region) !== authority.region) reject('AWS region mismatch');
  const azs = data.get('data.aws_availability_zones.available');
  if (!object(azs) || !Array.isArray(azs.names) || zones.some((zone, index) => azs.names[index] !== zone)) reject('AWS availability-zone selection mismatch');
  for (const address of expected.keys()) if (!seen.has(address)) reject(`${address}: missing planned resource`);
  if (!Array.isArray(plan.resource_changes)) reject('missing resource changes');
  const changes = new Map();
  let create = 0;
  let noOp = 0;
  for (const entry of plan.resource_changes) {
    if (!object(entry) || typeof entry.address !== 'string' || changes.has(entry.address)) reject('malformed or duplicate change');
    changes.set(entry.address, entry);
    if (!providers.has(entry.provider_name)) reject(`${entry.address}: unreviewed change provider`);
    if (own(entry, 'previous_address') || entry.change?.importing != null) reject(`${entry.address}: moves/imports require separate review`);
    const actions = entry.change?.actions;
    if (!Array.isArray(actions) || actions.length !== 1) reject(`${entry.address}: invalid/replacement actions`);
    if (entry.mode === 'data' && allowedData.has(entry.address)) {
      if (!['read', 'no-op'].includes(actions[0])) reject(`${entry.address}: invalid data action`);
      continue;
    }
    if (entry.mode !== 'managed' || !expected.has(entry.address) || entry.type !== entry.address.split('.')[2]) reject(`${entry.address}: unreviewed managed change`);
    if (actions[0] === 'create') create += 1;
    else if (actions[0] === 'no-op') noOp += 1;
    else reject(`${entry.address}: updates/deletes are not authorized by APPLY_DEV foundation`);
    checkValues({ address: entry.address, type: entry.type, values: entry.change.after }, expected.get(entry.address));
  }
  for (const address of expected.keys()) if (!changes.has(address)) reject(`${address}: missing managed change`);
  return { gate: 'dev-foundation-plan-v1', status: 'passed', ...authority, managedResources: expected.size, create, noOp, update: 0, destroy: 0,
    scope: 'Reviewed first dev foundation only; no service deployment or Phase 0 completion claim.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [input, output, ...extra] = process.argv.slice(2);
    if (!input || !output || extra.length) reject('usage: node verify-dev-plan.mjs <tofu-show.json> <summary.json>');
    const result = verifyDevPlan(JSON.parse(readFileSync(input, 'utf8')));
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'DEV_FOUNDATION_PLAN_REJECTED');
    process.exitCode = 1;
  }
}
