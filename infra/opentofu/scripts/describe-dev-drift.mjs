import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Diagnostic only: never authorizes apply or replaces verify-dev-plan.mjs.
// Output keys, resource addresses and action names come from explicit allowlists.
// No resource values, unknown key names, provider text or parser errors are logged.
const fields = new Set([
  'id', 'arn', 'region', 'owner_id', 'tags', 'tags_all', 'name', 'name_prefix',
  'route', 'vpc_id', 'route_table_id', 'route_table_ids', 'gateway_id',
  'subnet_id', 'subnet_ids', 'security_group_ids', 'network_interface_ids',
  'cidr_block', 'cidr_blocks', 'destination_cidr_block', 'availability_zone',
  'availability_zone_id', 'map_public_ip_on_launch', 'enable_dns_support',
  'enable_dns_hostnames', 'default_route_table_id', 'main_route_table_id',
  'default_network_acl_id', 'default_security_group_id', 'dhcp_options_id',
  'bucket', 'bucket_region', 'bucket_domain_name', 'bucket_regional_domain_name',
  'bucket_namespace', 'bucket_prefix', 'hosted_zone_id', 'force_destroy',
  'acceleration_status', 'acl', 'cors_rule', 'grant', 'lifecycle_rule', 'logging',
  'object_lock_configuration', 'object_lock_enabled', 'policy', 'request_payer',
  'replication_configuration', 'server_side_encryption_configuration',
  'versioning', 'website', 'website_domain', 'website_endpoint',
  'rule', 'versioning_configuration', 'block_public_acls', 'block_public_policy',
  'ignore_public_acls', 'restrict_public_buckets', 'encryption_configuration',
  'image_scanning_configuration', 'image_tag_mutability', 'registry_id',
  'repository', 'repository_url', 'force_delete', 'setting', 'configuration',
  'service_name', 'service_region', 'vpc_endpoint_type', 'state', 'prefix_list_id',
  'private_dns_enabled', 'dns_entry', 'dns_options', 'ip_address_type',
  'retention_in_days', 'deletion_protection_enabled', 'log_group_class',
]);
const actions = new Set(['no-op', 'read', 'create', 'update', 'delete', 'forget']);
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function describeDevDrift(plan, allowedAddresses) {
  if (!object(plan) || !(allowedAddresses instanceof Set)) throw new Error('invalid diagnostic input');
  const entries = plan.resource_drift ?? [];
  if (!Array.isArray(entries)) throw new Error('malformed resource drift');
  if (entries.length > 128) throw new Error('too many diagnostic entries');
  return {
    diagnostic: 'dev-resource-drift-v1', authorizesApply: false, count: entries.length,
    entries: entries.map((entry) => {
      const known = object(entry) && allowedAddresses.has(entry.address);
      const change = object(entry?.change) ? entry.change : {};
      const before = object(change.before) ? change.before : {};
      const after = object(change.after) ? change.after : {};
      const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter((key) => !isDeepStrictEqual(before[key], after[key])
          || Object.hasOwn(before, key) !== Object.hasOwn(after, key));
      return {
        address: known ? entry.address : '[unreviewed resource]',
        actions: Array.isArray(change.actions) && change.actions.length <= 2
          ? change.actions.map((action) => actions.has(action) ? action : '[invalid]') : ['[invalid]'],
        changedFields: known ? keys.filter((key) => fields.has(key)).sort() : [],
        redactedFields: known ? keys.filter((key) => !fields.has(key)).length : keys.length,
        beforeObject: object(change.before), afterObject: object(change.after),
      };
    }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [input, ...extra] = process.argv.slice(2);
    if (!input || extra.length) throw new Error('invalid arguments');
    const { expectedResources } = await import('./verify-dev-plan.mjs');
    console.log(JSON.stringify(describeDevDrift(JSON.parse(readFileSync(input, 'utf8')), new Set(expectedResources().keys()))));
  } catch {
    console.error('DEV_DRIFT_DIAGNOSTIC_FAILED');
    process.exitCode = 1;
  }
}
