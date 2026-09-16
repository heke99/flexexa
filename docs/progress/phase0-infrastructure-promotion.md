# Phase 0 — infrastructure-only main promotion

Date: 2026-09-16. This is a bounded infrastructure promotion, not Phase 0 acceptance.

## Scope and immutable source

The application remains on `phase/0-foundation`; aggregate PR #1 stays draft.
PR #39 was merged into that branch as `a22619e1b3c937dbbc92fed7783229e663315353`.
This promotion starts from main `43be0bfb40e44c1656a8aa88b988cb2b23c281aa` and
copies the following exact Git objects from reviewed source
`572120b2d142dd8f867964fcf00804109bb69757`:

| Path | Git object |
| --- | --- |
| `infra/opentofu` | tree `3840864cbb7d39534d8b60a4c6fc2d59618621e0` |
| `.github/workflows/opentofu-plan.yml` | blob `daedaa536c21839d4919a64c5c442acecc0c87cf` |
| `.github/workflows/opentofu-apply.yml` | blob `ad2efad5228adac3d771fddd9b722958d909f518` |

Only these executable paths and this evidence note are added. No application,
SQL migration, DB type, provider command, canonical model or existing master-plan
file is replaced. The two workflows are self-contained; no missing application
package is substituted with a successful placeholder check.

## Verification already observed on the full foundation tree

- Quality / plan coverage / codebase impact: successful run `35139562596`.
- Database replay and runtime authorization: successful run `35139562560`.
- Real read-only AWS plan: successful run `35139562524`, job `104940373268`.
- That job ran 77 positive/negative/CLI tests, with zero failures or skipped tests.
- The actual saved plan passed the guard: 52 creates, zero updates/deletes,
  account `938095765653`, region `eu-north-1`, environment `dev`.
- AWS provider resolved in that run: signed `hashicorp/aws` 6.64.0.

The main-target promotion must independently pass its real read-only AWS plan.
The application/DB/runtime checks above are exact-source evidence, not newly run
checks on an application-free main branch. CI is the execution evidence; no local
full-repository verification is claimed for this promotion.

Routing: `flexexa-aws-opentofu`, `aws-iam`, `flexexa-impact-analysis`,
`flexexa-security-review`, `flexexa-affected-verification`. Scope follows locked
master-plan sections 71, 73, 77 and 83. UI, provider and settlement implementation
are intentionally excluded. Changes to these source objects require renewed review.

## Deployment boundary

Merging this PR does not run an apply. The only application-infrastructure write
path remains `OpenTofu AWS apply`, manual `workflow_dispatch` on `main`, with
`confirm=APPLY_DEV`. The exact main-only OIDC trust is unchanged. No permanent
credentials, root application deployment, apply-on-push or apply-on-PR are added.

Before claiming infrastructure deployment, require successful saved-plan apply,
locked zero-drift re-plan and independent AWS readback. Before a first apply,
verify the ECS service-linked-role prerequisite and state-bucket transport policy.
Provider lock persistence and final least-privilege review remain open hardening.

Hosted services/private connectivity, observability and alert delivery, credentials
and approval lifecycle, hosted recovery/restore and applicable security/load/E2E
acceptance remain Phase 0 work. This promotion does not approve phases 1–13.
