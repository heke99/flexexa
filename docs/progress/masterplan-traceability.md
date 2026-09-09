# Locked master-plan traceability

The master specification remains unchanged. `plan:check` scans every nonempty source line,
including preamble, field lists and fenced code, and retains section, phase context, exact
text, hash and source line. Horizontal separators and blank lines are structural only.
These are **source points, not a count of independent semantic requirements**. Context and
cross-section dependencies still require engineering review.

All 88 sections (0–87) and 14 build phases (0–13) must exist in order. Section 0 and the
preamble are intentionally retained in addition to the user's points 1 through last.
The committed ledger pins source SHA256, generated catalog digest and total point count.
A removed field, skipped chapter, changed source or incomplete phase inventory fails CI.

## Two different commands
- `pnpm plan:check`: coverage/evidence integrity only; required by ordinary affected verification.
- `pnpm plan:ready`: exits nonzero until every source point and declared phase has recorded
  reviewed evidence for the current implementation snapshot, and the working tree is clean.

A green first command does not mean the product is ready. Evidence records name the exact
covered point IDs, reviewer, timestamp and CI run references; verified records are rejected
when their implementation/source hashes are stale or scope is missing. CI evidence must
be imported only after checking the real run and any required live/security/external proof.
The local validator does **not authenticate a remote CI receipt or prove a review truthful**;
this is a reviewed evidence ledger, not a deployment authorization mechanism.

## Current status
Known implemented boundaries are recorded in BUILD_STATUS and the individual PR ledgers.
No entire master-plan section or later product phase is declared complete from those PRs.
Fine-grained point assessments start unassessed; this does not erase existing code/tests.
It explicitly avoids assigning thousands of unsupported acceptance approvals automatically.
Source-point assessment status may be unassessed, partial, blocked or verified. There is
no silent `not_applicable` escape from the locked requirements.

Implementation hashes cover tracked source/configuration/infrastructure, excluding only
progress/evidence documents and generated index artifacts to avoid circular self-hashes.
Readiness additionally requires a clean working tree, so untracked source cannot be ignored.
Architecture instructions, dependency locks and migrations remain included in the snapshot.

## Continuation
After identity administration: trusted identity provisioning, consent/link/discovery,
resource-specific authorization, durable provider events, shadows/control, then outstanding
Phase 0 infrastructure/policy/observability/restore gates before smart-charging MVP approval.
Enode remains a replaceable adapter; first-party OCPP/OEM/Edge must work independently.
Review all related source points and tests on each change; update evidence only for the
actual verified scope. External device qualification, commercial data licenses and market
approvals are separate gates, never inferred from a simulator or frontend build.
