---
name: flexexa-aws-opentofu
description: "OpenTofu authority for Flexexa AWS infrastructure while AWS skills provide service semantics."
priority: critical
---

# flexexa-aws-opentofu — Flexexa repository skill

## Purpose
OpenTofu authority for Flexexa AWS infrastructure while AWS skills provide service semantics.

## Mandatory rules
- OpenTofu is Flexexa IaC authority; do not switch to CDK/CloudFormation implicitly.
- Use eu-north-1 by default.
- Use GitHub OIDC, remote state protection, environment separation and least privilege.
- Plan before apply; production applies require explicit review and read-back verification.

## Authority order
1. `FLEXEXA_MASTER_BUILD_PROMPT_V1.md`
2. Canonical schema/contracts/migrations and executed tests
3. This skill
4. Current vendor/framework documentation

## Completion
Pair this skill with `flexexa-impact-analysis`, `flexexa-security-review` and `flexexa-affected-verification` whenever the change is non-trivial.
