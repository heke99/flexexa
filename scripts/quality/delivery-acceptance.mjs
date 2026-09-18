import { createHash } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest('hex');
const fail = code => { throw Error(code); };
const text = value => typeof value === 'string' && value.trim().length > 0;
const sha256 = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const sha1 = value => typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
const kinds = ['ci', 'physical', 'operations', 'partner'];
const expectedIds = Array.from({ length: 10 }, (_, i) => `FXP-${String(i + 1).padStart(2, '0')}`);
const expectedCases = [3, 3, 3, 4, 3, 3, 3, 3, 3, 3];
export const DELIVERY_SOURCE = 'docs/plans/FLEXEXA_DELIVERY_ACCEPTANCE_V1_1.md';
export const DELIVERY_COVERAGE = 'docs/progress/delivery-acceptance-coverage.json';

function fields(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== names.length || names.some(name => !Object.hasOwn(value, name))) fail('DELIVERY_FIELDS_INVALID');
}
function unique(values) {
  if (new Set(values).size !== values.length) fail('DELIVERY_DUPLICATE_ID');
}
function integers(value, max) {
  if (!/^\d+(?:, \d+)*$/u.test(value)) fail('DELIVERY_MAPPING_INVALID');
  const result = value.split(', ').map(Number);
  unique(result);
  if (result.some(n => n < 0 || n > max)) fail('DELIVERY_MAPPING_INVALID');
  return result;
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(value) ||
      !Number.isFinite(Date.parse(value))) fail('DELIVERY_EVIDENCE_DATE_INVALID');
  if (new Date(value).toISOString() !== value.replace(/Z$/u, value.includes('.') ? 'Z' : '.000Z')) fail('DELIVERY_EVIDENCE_DATE_INVALID');
}

/** Parse the stable acceptance IDs in the actual normative document; not test execution. */
export function scanDeliveryAcceptance(source) {
  if (!text(source) || source.includes('\uFFFD')) fail('DELIVERY_SOURCE_INVALID');
  const requirements = [];
  let current = null;
  for (const line of source.split('\n')) {
    const heading = line.match(/^### (FXP-\d{2}) — (.+)$/u);
    if (heading) {
      current = { id: heading[1], title: heading[2], cases: [] };
      requirements.push(current);
      continue;
    }
    if (!current) continue;
    for (const [label, key, max] of [['Sections', 'sections', 87], ['Phases', 'phases', 13]]) {
      if (line.startsWith(`${label}: `)) {
        if (current[key]) fail('DELIVERY_MAPPING_INVALID');
        current[key] = integers(line.slice(label.length + 2), max);
      }
    }
    if (line.startsWith('Depends on: ')) {
      if (current.dependencies) fail('DELIVERY_MAPPING_INVALID');
      const value = line.slice(12);
      current.dependencies = value === 'none' ? [] : value.split(', ');
      unique(current.dependencies);
    }
    const criterion = line.match(/^- (FXP-\d{2}-T\d+) \[(ci|physical|operations|partner)\]: (.+)$/u);
    if (line.startsWith('- FXP-') && !criterion) fail('DELIVERY_CASE_INVALID');
    if (criterion) current.cases.push({ id: criterion[1], kind: criterion[2], description: criterion[3] });
  }
  if (requirements.length !== expectedIds.length) fail('DELIVERY_REQUIREMENT_SET_INVALID');
  for (const [i, requirement] of requirements.entries()) {
    if (requirement.id !== expectedIds[i] || !text(requirement.title) || !requirement.sections?.length ||
        !requirement.phases?.length || !Array.isArray(requirement.dependencies)) fail('DELIVERY_REQUIREMENT_SET_INVALID');
    if (requirement.dependencies.some(id => !expectedIds.slice(0, i).includes(id))) fail('DELIVERY_DEPENDENCY_INVALID');
    if (requirement.cases.length !== expectedCases[i] || requirement.cases.some((c, j) => c.id !== `${requirement.id}-T${j + 1}`)) fail('DELIVERY_CASE_SET_INVALID');
  }
  return { source_sha256: digest(source), requirements, case_count: requirements.reduce((n, r) => n + r.cases.length, 0) };
}

/** Offline record integrity only. Remote runs, hardware and approvals require independent review. */
export function assessDeliveryAcceptance(scan, ledger, baselineSha, implementationSha) {
  fields(ledger, ['schema_version', 'source_path', 'source_sha256', 'baseline_sha256', 'requirements', 'evidence']);
  if (ledger.schema_version !== 1 || ledger.source_path !== DELIVERY_SOURCE || !sha256(implementationSha) ||
      !sha256(baselineSha)) fail('DELIVERY_SCHEMA_INVALID');
  if (ledger.source_sha256 !== scan.source_sha256 || ledger.baseline_sha256 !== baselineSha) fail('DELIVERY_SOURCE_DRIFT');
  if (!Array.isArray(ledger.requirements) || !Array.isArray(ledger.evidence)) fail('DELIVERY_ARRAY_REQUIRED');
  if (ledger.requirements.length !== scan.requirements.length) fail('DELIVERY_COVERAGE_MISSING');
  const cases = new Map(scan.requirements.flatMap(r => r.cases).map(c => [c.id, c]));
  const evidence = new Map();
  for (const e of ledger.evidence) {
    fields(e, ['id', 'case_id', 'kind', 'source_sha256', 'implementation_sha256', 'head_sha', 'artifact_sha256', 'checked_at', 'reviewed_by', 'reference', 'result']);
    if (!text(e.id) || evidence.has(e.id)) fail('DELIVERY_DUPLICATE_ID');
    if (!cases.has(e.case_id) || !kinds.includes(e.kind) || cases.get(e.case_id).kind !== e.kind) fail('DELIVERY_EVIDENCE_KIND_INVALID');
    if (e.source_sha256 !== scan.source_sha256 || !sha256(e.implementation_sha256) || !sha1(e.head_sha) ||
        !sha256(e.artifact_sha256) || !text(e.reviewed_by) || e.result !== 'success') fail('DELIVERY_EVIDENCE_INVALID');
    timestamp(e.checked_at);
    if (typeof e.reference !== 'string' || !/^https:\/\/[^\s]+$/u.test(e.reference)) fail('DELIVERY_EVIDENCE_REFERENCE_INVALID');
    const url = new URL(e.reference);
    if (url.username || url.password || url.search || url.hash) fail('DELIVERY_EVIDENCE_REFERENCE_INVALID');
    if (e.kind === 'ci' && !/^https:\/\/github\.com\/heke99\/flexexa\/actions\/runs\/[1-9]\d*$/u.test(e.reference)) fail('DELIVERY_EVIDENCE_REFERENCE_INVALID');
    evidence.set(e.id, e);
  }
  const states = new Map(), used = new Set();
  const counts = { planned: 0, partial: 0, blocked: 0, verified: 0 };
  for (const [i, r] of ledger.requirements.entries()) {
    fields(r, ['id', 'status', 'evidence_ids', 'note']);
    const expected = scan.requirements[i];
    if (r.id !== expected.id || typeof r.status !== 'string' || !Object.hasOwn(counts, r.status) || !text(r.note) || !Array.isArray(r.evidence_ids)) fail('DELIVERY_COVERAGE_INVALID');
    unique(r.evidence_ids);
    const relevant = new Map(expected.cases.map(c => [c.id, c]));
    const covered = new Set();
    for (const id of r.evidence_ids) {
      const e = evidence.get(id);
      if (!e || !relevant.has(e.case_id)) fail('DELIVERY_EVIDENCE_SCOPE_INVALID');
      if (r.status === 'verified' && e.implementation_sha256 !== implementationSha) fail('DELIVERY_STALE_EVIDENCE');
      covered.add(e.case_id); used.add(id);
    }
    if (r.status === 'verified') {
      if (covered.size !== expected.cases.length) fail('DELIVERY_VERIFIED_WITHOUT_EVIDENCE');
      if (expected.dependencies.some(id => states.get(id) !== 'verified')) fail('DELIVERY_DEPENDENCY_NOT_READY');
    }
    states.set(r.id, r.status); counts[r.status]++;
  }
  if (used.size !== evidence.size) fail('DELIVERY_ORPHAN_EVIDENCE');
  return { source_sha256: scan.source_sha256, coverage_integrity: true, counts, requirement_count: scan.requirements.length,
    case_count: scan.case_count, recorded_delivery_ready: counts.verified === scan.requirements.length,
    requirements: ledger.requirements, limitations: [
      'Acceptance case definitions are not executed tests.',
      'Offline metadata validation does not authenticate a CI run, physical test or external approval.',
      'Readiness is recorded scope only, never authority to deploy, control devices, bid or pay.'
    ] };
}

export function combinePlanReadiness(baselineReady, deliveryReady, cleanWorktree) {
  return baselineReady === true && deliveryReady === true && cleanWorktree === true;
}
