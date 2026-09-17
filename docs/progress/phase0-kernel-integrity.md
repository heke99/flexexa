# Phase 0 — policy result integrity

Locked sections 9–14 require deterministic, non-widening constraints. Review found
that the existing pure power-policy intersection froze only its outer result: a
consumer could mutate the decided maximum and its evidence arrays after evaluation.
The regression test reproduced the defect before the fix.

The evaluator now freezes its constraints, reason codes and applied-version list,
returns detached canonical IDs and rejects unknown keys, malformed lists, nonnumeric
limits and invalid reason codes at runtime. Evaluation work is bounded to 1024 limits
and 128 supplied reasons. Duplicate canonical IDs/reasons produce stable evidence.
Existing half-open validity, conflict denial and lower-limit precedence are preserved.
No JavaScript expression execution, LLM evaluation, authorization grant or physical
command is introduced. This pure evaluator is still not a publication/signature service.

Activated repository codebase index, impact analysis, affected verification, code and
security review and test strategy. Reviewed locked master sections 9–14, 83–85,
AGENTS, skills-lock, current Kernel consumers and BUILD_STATUS. Database/Auth and
runtime CI remain required by the HIGH-risk full verification policy; no SQL change
is needed for this in-memory result fix. UI/provider/AWS deployment skills are skipped.

Verification includes mutation attempts, malformed runtime data, sparse and oversized
lists, canonical IDs, half-open boundaries and the existing 400 constraint combinations.
Final exact-head CI, development history/catalog parity and merge evidence are in its PR.
The full versioned policy registry, critical tests/shadow/approval/publish/readiness flow
and signed snapshot distribution remain unfinished Phase 0 boundaries.
