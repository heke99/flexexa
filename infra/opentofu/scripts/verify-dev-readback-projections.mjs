import { isDeepStrictEqual as equal } from 'node:util';

// Only the four readback projections observed after run 35195030570.
// The independently managed owners must already be unchanged and consistent.
// This authorizes no resource operations, imports, moves, or general drift.
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const reject = (stage) => { throw new Error(`DEV_FOUNDATION_PLAN_REJECTED: unreviewed resource drift (${stage})`); };
const prefix = 'module.foundation.';
const reviewed = new Map([
  [`${prefix}aws_route_table.public`, 'route'],
  ...['audit', 'raw', 'settlement'].map((purpose) => [`${prefix}aws_s3_bucket.storage["${purpose}"]`, 'versioning']),
]);
const routeFields = new Set([
  'cidr_block', 'gateway_id', 'ipv6_cidr_block', 'destination_prefix_list_id',
  'carrier_gateway_id', 'core_network_arn', 'egress_only_gateway_id',
  'local_gateway_id', 'nat_gateway_id', 'network_interface_id',
  'transit_gateway_id', 'vpc_endpoint_id', 'vpc_peering_connection_id',
]);
const known = (value) => value === false || (object(value) && Object.values(value).every(known))
  || (Array.isArray(value) && value.every(known));
const id = (value, kind) => typeof value === 'string' && new RegExp(`^${kind}-[0-9a-f]{17}$`).test(value);
const without = (value, field) => Object.fromEntries(Object.entries(value).filter(([key]) => key !== field));

export function verifyReadbackProjections(plan, planned, changes) {
  const drift = plan.resource_drift ?? [];
  if (!Array.isArray(drift) || drift.length > reviewed.size) reject('shape');
  if (drift.length === 0) return 0;
  // Even an unrelated creation requires separate review when reconciling state.
  if ([...changes.values()].some((entry) => !equal(entry.change?.actions, ['no-op'])
    || !object(entry.change.before) || !equal(entry.change.before, entry.change.after)
    || !known(entry.change.after_unknown ?? {}))) reject('non-noop-plan');
  const stable = (address) => {
    const entry = changes.get(address);
    const resource = planned.get(address);
    if (!entry || !resource || entry.mode !== 'managed' || resource.mode !== 'managed'
      || entry.provider_name !== resource.provider_name || entry.type !== resource.type
      || !equal(entry.change.after, resource.values)
      || Object.hasOwn(entry, 'previous_address') || entry.change.importing != null) reject('owner-parity');
    return entry.change.after;
  };
  const seen = new Set();
  for (const entry of drift) {
    if (!object(entry) || !reviewed.has(entry.address) || seen.has(entry.address)) reject('address');
    seen.add(entry.address);
    const field = reviewed.get(entry.address);
    const resource = planned.get(entry.address);
    const change = entry.change;
    if (!resource || entry.mode !== 'managed' || entry.type !== resource.type
      || entry.provider_name !== resource.provider_name || Object.hasOwn(entry, 'previous_address')
      || !object(change) || change.importing != null || !equal(change.actions, ['update'])
      || !object(change.before) || !object(change.after) || !known(change.after_unknown ?? {})) reject('identity');
    const after = stable(entry.address);
    if (!equal(change.after, after) || !Object.hasOwn(change.before, field)
      || !Object.hasOwn(after, field) || equal(change.before[field], after[field])
      || !equal(without(change.before, field), without(after, field))) reject('field-parity');
    if (field === 'versioning') {
      if (!equal(change.before.versioning, [{ enabled: false, mfa_delete: false }])
        || !equal(after.versioning, [{ enabled: true, mfa_delete: false }])) reject('versioning-shape');
      const owner = stable(entry.address.replace('aws_s3_bucket.', 'aws_s3_bucket_versioning.'));
      const purpose = /^module\.foundation\.aws_s3_bucket\.storage\["(audit|raw|settlement)"\]$/.exec(entry.address)?.[1];
      const bucket = `flexexa-dev-${purpose}-938095765653`;
      if (after.id !== bucket || after.bucket !== bucket || after.region !== 'eu-north-1'
        || owner.bucket !== bucket || owner.id !== bucket || owner.region !== 'eu-north-1'
        || !equal(owner.versioning_configuration, [{ mfa_delete: 'Disabled', status: 'Enabled' }])) reject('versioning-owner');
    } else {
      const route = stable(`${prefix}aws_route.public_internet`);
      const gateway = stable(`${prefix}aws_internet_gateway.this`);
      const vpc = stable(`${prefix}aws_vpc.this`);
      if (!equal(change.before.route, []) || !Array.isArray(after.route) || after.route.length !== 1
        || !id(after.id, 'rtb') || !id(vpc.id, 'vpc') || !id(gateway.id, 'igw')
        || after.vpc_id !== vpc.id || gateway.vpc_id !== vpc.id
        || route.route_table_id !== after.id || route.gateway_id !== gateway.id
        || route.destination_cidr_block !== '0.0.0.0/0' || route.state !== 'active'
        || route.origin !== 'CreateRoute'
        || [after, route, gateway, vpc].some((value) => value.region !== 'eu-north-1')
        || [after, gateway, vpc].some((value) => value.owner_id !== '938095765653')) reject('route-owner');
      const projection = after.route[0];
      if (!object(projection) || projection.cidr_block !== route.destination_cidr_block
        || projection.gateway_id !== route.gateway_id
        || Object.entries(projection).some(([key, value]) => !routeFields.has(key)
          || (!['cidr_block', 'gateway_id'].includes(key) && value !== '' && value !== null))) reject('route-projection');
    }
  }
  return drift.length;
}
