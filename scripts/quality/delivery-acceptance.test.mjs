import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scanDeliveryAcceptance, assessDeliveryAcceptance, combinePlanReadiness, DELIVERY_SOURCE, DELIVERY_COVERAGE } from './delivery-acceptance.mjs';

const root = new URL('../../', import.meta.url);
const source = fs.readFileSync(new URL(DELIVERY_SOURCE, root), 'utf8');
const committed = JSON.parse(fs.readFileSync(new URL(DELIVERY_COVERAGE, root), 'utf8'));
const scan = scanDeliveryAcceptance(source);
const implementationSha = 'a'.repeat(64);
const baselineSha = committed.baseline_sha256;
const fresh = () => ({ schema_version: 1, source_path: DELIVERY_SOURCE, source_sha256: scan.source_sha256,
  baseline_sha256: baselineSha, requirements: scan.requirements.map(r => ({ id: r.id, status: 'planned', evidence_ids: [], note: 'Synthetic unit-test fixture; not product evidence.' })), evidence: [] });
const assess = ledger => assessDeliveryAcceptance(scan, ledger, baselineSha, implementationSha);
function prove(ledger, index) {
  const r = ledger.requirements[index];
  r.status = 'verified';
  for (const c of scan.requirements[index].cases) {
    const e = { id: `fixture-${c.id}`, case_id: c.id, kind: c.kind, source_sha256: scan.source_sha256,
      implementation_sha256: implementationSha, head_sha: 'b'.repeat(40), artifact_sha256: 'c'.repeat(64),
      checked_at: '2026-09-18T10:00:00Z', reviewed_by: 'synthetic-test-only', result: 'success',
      reference: c.kind === 'ci' ? 'https://github.com/heke99/flexexa/actions/runs/123' : `https://evidence.example.test/${c.id}` };
    ledger.evidence.push(e); r.evidence_ids.push(e.id);
  }
  return ledger;
}
const allProven = () => { const ledger = fresh(); for (let i = 0; i < 10; i++) prove(ledger, i); return ledger; };

// The synthetic complete ledger below tests validator mechanics, never live product completion.
test('catalogue retains ten requirements and all 31 specified acceptance cases', () => {
  assert.equal(scan.requirements.length, 10); assert.equal(scan.case_count, 31);
  assert.equal(scan.source_sha256, committed.source_sha256);
  assert.equal(assess(committed).coverage_integrity, true);
});
test('planned integrity is green but readiness is false', () => assert.equal(assess(fresh()).recorded_delivery_ready, false));
test('fully evidenced synthetic ledger validates recorded readiness', () => assert.equal(assess(allProven()).recorded_delivery_ready, true));
test('readiness is conjunction of exact booleans and clean source', () => {
  for (const a of [true, false]) for (const b of [true, false]) for (const c of [true, false]) assert.equal(combinePlanReadiness(a, b, c), a && b && c);
  assert.equal(combinePlanReadiness('true', true, true), false);
});
test('deleted requirement is rejected', () => assert.throws(() => scanDeliveryAcceptance(source.replace('### FXP-05 —', '### Removed —')), /DELIVERY_/u));
test('deleted acceptance case is rejected', () => assert.throws(() => scanDeliveryAcceptance(source.replace(/^- FXP-04-T4 .*\n/mu, '')), /DELIVERY_CASE_SET_INVALID/u));
test('duplicate case is rejected', () => assert.throws(() => scanDeliveryAcceptance(source.replace('FXP-04-T4 [ci]', 'FXP-04-T3 [ci]')), /DELIVERY_CASE_SET_INVALID/u));
test('simulator proof cannot be named physical proof', () => assert.throws(() => scanDeliveryAcceptance(source.replace('[physical]', '[simulator]')), /DELIVERY_CASE_INVALID/u));
test('invalid section mapping is rejected', () => assert.throws(() => scanDeliveryAcceptance(source.replace('Sections: 3, 77', 'Sections: 99, 77')), /DELIVERY_MAPPING_INVALID/u));
test('future/cyclic dependency is rejected', () => assert.throws(() => scanDeliveryAcceptance(source.replace('Depends on: none', 'Depends on: FXP-10')), /DELIVERY_DEPENDENCY_INVALID/u));
test('changed normative source needs explicit register reconciliation', () => { const l = fresh(); l.source_sha256 = 'd'.repeat(64); assert.throws(() => assess(l), /DELIVERY_SOURCE_DRIFT/u); });
test('changed V1 baseline is rejected', () => { const l = fresh(); l.baseline_sha256 = 'd'.repeat(64); assert.throws(() => assess(l), /DELIVERY_SOURCE_DRIFT/u); });
test('coverage removal is rejected', () => { const l = fresh(); l.requirements.pop(); assert.throws(() => assess(l), /DELIVERY_COVERAGE_MISSING/u); });
test('unknown coverage fields are rejected', () => { const l = fresh(); l.requirements[0].approved = true; assert.throws(() => assess(l), /DELIVERY_FIELDS_INVALID/u); });
test('non-string status cannot coerce to verified', () => { const l = fresh(); for (const r of l.requirements) r.status = ['verified']; assert.throws(() => assess(l), /DELIVERY_COVERAGE_INVALID/u); });
test('verified without execution evidence is rejected', () => { const l = fresh(); l.requirements[0].status = 'verified'; assert.throws(() => assess(l), /DELIVERY_VERIFIED_WITHOUT_EVIDENCE/u); });
test('missing one case prevents requirement acceptance', () => { const l = prove(fresh(), 0); l.requirements[0].evidence_ids.pop(); l.evidence.pop(); assert.throws(() => assess(l), /DELIVERY_VERIFIED_WITHOUT_EVIDENCE/u); });
test('physical/operations proof cannot be replaced by CI', () => { const l = prove(fresh(), 0); l.evidence[2].kind = 'ci'; assert.throws(() => assess(l), /DELIVERY_EVIDENCE_KIND_INVALID/u); });
test('old implementation evidence cannot approve current code', () => { const l = prove(fresh(), 0); l.evidence[0].implementation_sha256 = 'd'.repeat(64); assert.throws(() => assess(l), /DELIVERY_STALE_EVIDENCE/u); });
test('skipped or neutral runs are not successful evidence', () => { for (const result of ['skipped', 'neutral', 'failure']) { const l = prove(fresh(), 0); l.evidence[0].result = result; assert.throws(() => assess(l), /DELIVERY_EVIDENCE_INVALID/u); } });
test('evidence must refer to the acceptance case owned by the requirement', () => { const l = prove(fresh(), 0); l.evidence[0].case_id = 'FXP-02-T1'; assert.throws(() => assess(l), /DELIVERY_EVIDENCE_SCOPE_INVALID/u); });
test('dependency cannot be accepted by accepting its successor', () => assert.throws(() => assess(prove(fresh(), 1)), /DELIVERY_DEPENDENCY_NOT_READY/u));
test('duplicate evidence IDs rejected', () => { const l = prove(fresh(), 0); l.evidence.push(structuredClone(l.evidence[0])); assert.throws(() => assess(l), /DELIVERY_DUPLICATE_ID/u); });
test('evidence must be linked, not orphaned metadata', () => { const l = prove(fresh(), 0); l.requirements[0].status = 'partial'; l.requirements[0].evidence_ids.pop(); assert.throws(() => assess(l), /DELIVERY_ORPHAN_EVIDENCE/u); });
test('CI reference must be an exact repository run, not a mutable branch', () => { const l = prove(fresh(), 0); l.evidence[0].reference = 'https://github.com/heke99/flexexa/tree/main'; assert.throws(() => assess(l), /DELIVERY_EVIDENCE_REFERENCE_INVALID/u); });
test('references cannot carry credentials, signed query parameters or fragments', () => {
  for (const reference of ['https://user:secret@evidence.example.test/1', 'https://evidence.example.test/1?token=secret', 'https://evidence.example.test/1#secret']) {
    const l = prove(fresh(), 0); l.evidence[2].reference = reference; assert.throws(() => assess(l), /DELIVERY_EVIDENCE_REFERENCE_INVALID/u);
  }
});
test('invalid dates and impossible calendar dates rejected', () => {
  for (const value of ['tomorrow', '2026-02-30T10:00:00Z']) { const l = prove(fresh(), 0); l.evidence[0].checked_at = value; assert.throws(() => assess(l), /DELIVERY_EVIDENCE_DATE_INVALID/u); }
});
test('hash and source bindings are mandatory', () => {
  for (const key of ['source_sha256', 'head_sha', 'artifact_sha256']) { const l = prove(fresh(), 0); l.evidence[0][key] = 'invalid'; assert.throws(() => assess(l), /DELIVERY_EVIDENCE_INVALID/u); }
});
