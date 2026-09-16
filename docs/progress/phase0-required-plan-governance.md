# Phase 0 — required-plan CI and the owner-only deployment handoff

Date: 2026-09-16. Scope: required-check scheduling and pre-credential PR trust.
This is not actual branch protection, a deployment, or complete Phase 0 governance.

## Defect and implementation

The existing OpenTofu plan used path filters. Making that check required on main
would leave unrelated/documentation-only PRs pending without a plan result.
Its job-level same-repository condition also turned an untrusted fork into a
skipped job, which GitHub can consider successful for required-check purposes.

The plan now runs on every PR targeting main or phase/0-foundation. A first shell
step explicitly rejects wrong events, repository names/IDs and fork repository
IDs before checkout or AWS credentials. Untrusted PRs fail, rather than becoming
an apparently acceptable skipped plan. Fork contributions require a separately
reviewed trusted-branch submission; the workflow does not grant fork AWS access.

The stable required job is `plan-dev`. Node tests, readonly provider initialization,
real read-only AWS plan, exact 52-resource saved-plan gate, OIDC identity, token
permissions and artifacts remain unchanged. No push, workflow_run or automatic
apply trigger is introduced. The manual protected-main apply workflow is unchanged.

## Verification and routing

20 standalone Node tests passed locally, including actual bash execution for
trusted, missing, wrong-event and fork contexts and literal shell-looking input.
These tests check configuration and the actual validation shell, not a local
emulation of the entire GitHub event scheduler. Full foundation quality/index/
impact, application/DB/runtime/recovery and real AWS plan remain required in CI.
The main projection must use identical blobs and pass its own real AWS plan.
No local full-repository dependency install or hosted deployment is claimed.

Master-plan sections 71, 77 and 83. Activated: flexexa-aws-opentofu,
flexexa-impact-analysis, flexexa-security-review, flexexa-affected-verification.
No SQL, domain or provider behavior is changed. Prior bootstrap evidence remains
in PR #43 and phase0-bootstrap-remediation.md; isolated tests are not hosted proof.

## Actual connector boundary

The connected GitHub application can publish PRs, read CI and merge tested heads,
but it does not expose initial workflow dispatch or branch-protection writes.
The actual branch-protection GET was denied with HTTP 403. General user approval
does not change that application's permissions. Do not request permanent tokens,
introduce an alternate apply trigger or remove the protection guard to bypass it.

After the exact reviewed workflow is merged to main, a repository owner/admin
must establish real main protection. Use a rule targeting `main` that requires
pull requests, requires `plan-dev` from GitHub Actions and requires the branch to
be current. Require conversation resolution, disallow force pushes and deletions,
and apply the rule to administrators without a bypass. Do not configure a dummy
check. Independent-review requirements need a real available reviewer; a review
submitted through the author's own account is not independent approval.

Read the effective rule back. The workflow's `protected=true` flag is only a
necessary minimum and is not proof of all reviewer/ruleset requirements.

Only after bootstrap and governance prerequisites are independently verified,
start the existing workflow in GitHub:

1. Actions -> OpenTofu AWS apply -> Run workflow.
2. Branch: `main`; input `confirm`: `APPLY_DEV`.
3. Keep the exact current main commit and all fail-closed gates unchanged.

Equivalent command for an already authenticated authorized owner (not an agent
bypass or an instruction to create a new token):

```sh
gh workflow run opentofu-apply.yml --repo heke99/flexexa --ref main -f confirm=APPLY_DEV
```

A submitted run is not deployment success. Require the actual saved-plan apply,
locked zero-drift plan and independent AWS readback. Failed initial apply must be
diagnosed from its real logs; never widen permissions generically. Hosted services,
private connectivity, alert delivery, credentials/approvals, restore/security/load
and end-to-end acceptance remain later Phase 0 gates. Main's intentional lack of
apps/web is not a successful Vercel deployment.

## Primary references

- https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks
- https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
