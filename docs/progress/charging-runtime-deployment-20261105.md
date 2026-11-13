# Initial charging API Fargate development release

Publishes the selected read-only charging API behind HTTPS on api-staging.flexexa.com. Image digest is read back from successful protected-main image release 42087448279 and pinned in development variables. Certificate is independently confirmed ISSUED. No physical car commands are exposed.

Expected plan: 18 initial runtime creates, zero updates/deletes to the existing 52-resource foundation; existing certificate remains no-op. Runtime plan guard checks the complete resource allowlist, bounded roles, nonroot/read-only/capability-free container, fixed Supabase public configuration, private Fargate networking, HTTPS certificate and service limits. The original foundation no-op guard remains active.

Runtime role permissions boundary caps image pulls and API log writes; task role has no identity policy. CI/apply roles retain protected-main OIDC restrictions. Access Analyzer reported no policy findings before review. Runtime permission policies require bootstrap attachment before apply; no application AWS credentials are embedded.

After apply, verify ECS service stability, healthy ALB target and exact image digest. Only then add api-staging CNAME to the ALB and verify HTTPS liveness and unauthorized admission. Authenticated company/admin journeys and physical charging remain separate acceptance checks.
