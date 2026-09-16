import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Structural regression tests only. AWS ValidatePolicy/SimulateCustomPolicy and
// live readback are separate evidence; this is not a replacement IAM evaluator.
const load = (name) => JSON.parse(readFileSync(new URL(`../bootstrap/${name}`, import.meta.url), 'utf8'));
const oldPolicy = load('apply-policy-v1-observed.json');
const policy = load('apply-policy-v2.json');
const tls = load('state-tls-policy.json');
const statement = (sid) => policy.Statement.find((s) => s.Sid === sid);
const array = (v) => Array.isArray(v) ? v : [v];
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v;
const digest = (v) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const stateArn = 'arn:aws:s3:::flexexa-tofu-state-938095765653';
const stateKey = `${stateArn}/flexexa/dev/foundation.tfstate`;
const buckets = ['raw', 'audit', 'settlement'].map((p) => `arn:aws:s3:::flexexa-dev-${p}-938095765653`);
const readbacks = ['s3:GetBucketAcl', 's3:GetBucketCORS', 's3:GetBucketWebsite', 's3:GetBucketPolicy',
  's3:GetLifecycleConfiguration', 's3:GetReplicationConfiguration', 's3:GetBucketLogging',
  's3:GetAccelerateConfiguration', 's3:GetBucketRequestPayment', 's3:GetBucketObjectLockConfiguration'];

test('observed baseline is the exact reviewed live v1', () => {
  assert.equal(digest(oldPolicy), 'c7c8da7f68341fc7ac406c24a3021b752d338ebe6ea977e79d38446e11c83c15');
});
test('candidate and transport policy are bound to the reviewed change', () => {
  assert.equal(digest(policy), 'c7946a031404a09ff982fcd1a7653c3243e599091c18077f5c1b4a7d6f685a4b');
  assert.equal(digest(tls), '4fd9ab6a65d4406ff244ded58ff36d2826afa3c2320c1a743e922daf6f0ecec7');
});
test('policy fits the managed-policy size limit and has unique statements', () => {
  assert.ok(JSON.stringify(policy).length < 6144);
  assert.equal(policy.Version, '2012-10-17');
  assert.equal(new Set(policy.Statement.map((s) => s.Sid)).size, policy.Statement.length);
});
test('listing keeps its prefix restriction while metadata has no listing-only condition', () => {
  assert.deepEqual(statement('OpenTofuState').Action, ['s3:ListBucket']);
  assert.deepEqual(statement('OpenTofuState').Condition, oldPolicy.Statement[0].Condition);
  assert.deepEqual(statement('OpenTofuStateMetadata').Action, ['s3:GetBucketLocation', 's3:GetBucketVersioning']);
  assert.deepEqual(statement('OpenTofuStateMetadata').Resource, [stateArn]);
  assert.equal(statement('OpenTofuStateMetadata').Condition, undefined);
});
test('state reads and writes are restricted to the one default-workspace object', () => {
  assert.deepEqual(statement('OpenTofuStateObjects').Resource, [stateKey]);
  assert.deepEqual(statement('OpenTofuStateObjects').Action, ['s3:GetObject', 's3:GetObjectVersion', 's3:PutObject']);
});
test('deleting state is no longer permitted; only the exact lock may be deleted', () => {
  const deletions = policy.Statement.filter((s) => array(s.Action).includes('s3:DeleteObject'));
  assert.equal(deletions.length, 1);
  assert.deepEqual(deletions[0].Resource, [`${stateKey}.tflock`]);
  assert.deepEqual(deletions[0].Action, ['s3:GetObject', 's3:PutObject', 's3:DeleteObject']);
});
test('only known bucket metadata reads are added, never object access or writes', () => {
  const oldActions = new Set(oldPolicy.Statement.flatMap((s) => array(s.Action)));
  const added = policy.Statement.flatMap((s) => array(s.Action)).filter((a) => !oldActions.has(a));
  assert.deepEqual([...new Set(added)].sort(), [...readbacks].sort());
  assert.ok(added.every((a) => a.startsWith('s3:Get')));
});
for (const action of readbacks) test(`metadata correction contains ${action} only for the three dev buckets`, () => {
  const grants = policy.Statement.filter((s) => array(s.Action).includes(action));
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0].Resource, buckets);
});
test('no IAM mutation, role passing, secrets or token permissions are introduced', () => {
  const actions = policy.Statement.flatMap((s) => array(s.Action));
  assert.ok(actions.every((a) => !/^(iam|sts|secretsmanager|kms):/.test(a)));
  assert.ok(!actions.includes('*'));
});
test('EC2 scope is preserved rather than falsely certified as least privilege', () => {
  assert.deepEqual(statement('FlexexaEc2Foundation'), oldPolicy.Statement.find((s) => s.Sid === 'FlexexaEc2Foundation'));
});
test('ECS resource scope is exactly the development cluster', () => {
  assert.equal(statement('FlexexaEcsFoundation').Resource, 'arn:aws:ecs:eu-north-1:938095765653:cluster/flexexa-dev');
});
test('ECR does not retain the old all-environments project wildcard', () => {
  assert.deepEqual(statement('FlexexaEcrFoundation').Resource, ['arn:aws:ecr:eu-north-1:938095765653:repository/flexexa/dev/*']);
});
test('log writes are development-scoped; global describe stays read-only and regional', () => {
  assert.equal(statement('FlexexaLogsFoundation').Resource, 'arn:aws:logs:eu-north-1:938095765653:log-group:/flexexa/dev/*');
  assert.deepEqual(statement('FlexexaDescribeLogGroups').Action, ['logs:DescribeLogGroups']);
  assert.deepEqual(statement('FlexexaDescribeLogGroups').Condition, { StringEquals: { 'aws:RequestedRegion': 'eu-north-1' } });
});
test('TLS policy is denial-only for the bucket and every object', () => {
  assert.equal(tls.Statement.length, 1);
  const s = tls.Statement[0];
  assert.equal(s.Effect, 'Deny'); assert.equal(s.Principal, '*'); assert.equal(s.Action, 's3:*');
  assert.deepEqual(s.Resource, [stateArn, `${stateArn}/*`]);
  assert.deepEqual(s.Condition, { Bool: { 'aws:SecureTransport': 'false', 'aws:PrincipalIsAWSService': 'false' } });
});
test('bootstrap HCL reproduces TLS conditions and uses AWS-managed ECS service identity', () => {
  const hcl = readFileSync(new URL('../bootstrap-state/security.tf', import.meta.url), 'utf8');
  assert.match(hcl, /resource "aws_s3_bucket_policy" "state_tls"/);
  assert.match(hcl, /"aws:SecureTransport"\s*= "false"/);
  assert.match(hcl, /"aws:PrincipalIsAWSService"\s*= "false"/);
  assert.match(hcl, /resource "aws_iam_service_linked_role" "ecs"/);
  assert.match(hcl, /aws_service_name = "ecs\.amazonaws\.com"/);
  assert.match(hcl, /prevent_destroy = true/);
  assert.doesNotMatch(hcl, /aws_iam_user|aws_iam_access_key|AdministratorAccess/);
});
