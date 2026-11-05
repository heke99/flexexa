# Charging API development image release

Publishes only verified source `6c39394b78de49b0b987c6ed4550f2f15f6a303b` from protected current main. Rechecks all three successful source CI workflows, vendor signature, non-root isolated HTTP smoke and HIGH/CRITICAL scan before AWS credentials. ECR upload scope is only `flexexa/dev/api`, with immutable source tag and digest readback/config identity comparison. No ECS resources or public website are changed. Main-only OIDC trust remains unchanged.

Strato confirmed successful creation of the ACM DNS validation CNAME on 2026-11-05. ACM status remains subject to independent AWS readback. API traffic DNS must be added only after healthy Fargate/ALB deployment.
