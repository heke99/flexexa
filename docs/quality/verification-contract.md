# Verification means executed evidence

Package test commands now run real Node test suites. `tests pending`, a zero-test suite or a successful build is not behavioral evidence.

`pnpm verify:affected -- --base <ref>` includes lint, typecheck, actual tests and build. It fails when required domain checks remain pending. CI may explicitly use `--application-only` for the application job, but that success does not mark database replay, IAM review, an infrastructure plan or browser E2E as passed. The JSON report carries the exact head/base and pending checks. Never use an application-only status as the aggregate merge gate.

The index reads Git-tracked/nonignored working files, not secret env files. It includes relative imports and reverse workspace dependencies. It is a conservative syntactic index, not a full AST/database/event semantic graph. Unresolved/dynamic edges force full application tests; database changes always require isolated migration replay and RLS tests. Missing Git base refs are errors, never empty LOW-risk reports. Uncommitted changes are included.

Canonical modules use one snake_case wire representation, exact decimal strings/BigInt for financial conversion, explicit tenant IDs and runtime validation. Provider spellings stop at adapters. Current DB legacy spellings are NOT silently blessed as canonical: their forward migration remains a separate stage.

The pure Kernel power-limit intersection is only a tested deterministic building block. It does not authenticate callers, verify policy signatures, publish policy versions, authorize a market action or replace local electrical safety.

Before main: require app verification, current complete DB replay/tests, current IaC plan and IAM review, plus browser E2E for UI changes. The parent Phase 0 PR remains draft until those scopes and the remaining Phase 0 features are completed.
