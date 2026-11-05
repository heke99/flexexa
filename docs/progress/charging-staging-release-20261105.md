# Flexexa charging staging release — 2026-11-05

The selected read-only charging API is running on private AWS Fargate behind an active HTTPS ALB. The portal and live prices have a stable Vercel staging domain. This is a development release; vehicle control and full partner onboarding are not accepted as complete.

## Verified endpoints

| Endpoint | Observed result |
| --- | --- |
| https://staging.flexexa.com/portal | HTTPS 200; password login UI rendered in browser |
| https://staging.flexexa.com/prices | Browser loaded SE3, 2026-11-05, 96 intervals |
| https://staging.flexexa.com/api/prices?area=SE3&date=2026-11-05 | 200; live elprisetjustnu.se source, explicit ex-VAT spot price and excluded tax/grid/retailer fees |
| https://api-staging.flexexa.com/health/live | Public DNS HTTPS 200; `{"status":"alive"}`; no-store |
| Company inventory without Authorization | 401 `UNAUTHENTICATED`; no-store |
| Platform inventory without Authorization | 401 `UNAUTHENTICATED`; no-store |
| Company inventory with synthetic invalid bearer | 403 `PERMISSION_DENIED`; no-store |

Curl retained TLS verification and exited successfully. The protected-main release also checked HTTPS through the ALB using the API hostname for SNI before public DNS cutover.

## Deployment evidence

- Successful protected-main release: https://github.com/heke99/flexexa/actions/runs/42097801703
- Main release commit: `0e8d8b306e85280ff14facf9035cc2284058ed91`.
- App image source: `6c39394b78de49b0b987c6ed4550f2f15f6a303b`.
- ECR digest: `sha256:6941d34a9437f9b44c86d5c6d3f867717d7d0c6f3cf3ed041fa5313d4584bccd`.
- ECS service: `flexexa-dev/flexexa-dev-charging-api`; desired 1, running 1, pending 0; task RUNNING/HEALTHY and ALB target healthy on port 8080.
- Task definition revision 1 matches the exact scanned image digest.
- ALB: `flexexa-dev-charging-api-1904904238.eu-north-1.elb.amazonaws.com`.
- API ACM certificate: `4bba5691-0345-4941-bb65-14572415bce9`, ISSUED in eu-north-1.
- Vercel deployment: `dpl_5aUyPAUuTMhX5NhyrtLNLu7iii6c`, frontend source `28f1c27e4d53853b34e168ea50b4298f755a59ac`; later backend-runtime source changes do not alter this frontend.
- Vercel staging domain follows `feat/live-prices-auth-20261105`; preview protection retained. Vercel TLS is issued and auto-renewed.
- Strato saved the API and portal CNAME records; existing www, apex and mail settings were preserved.

## Infrastructure controls

All application infrastructure was applied through reviewed saved OpenTofu plans from protected main. The foundation remained 52 no-op resources. The final resume created seven missing resources with eleven unchanged runtime resources and no updates/deletions/replacements. Narrow IAM bootstrap policy extensions were validated and read back separately; protected-main OIDC trust was unchanged.

The task is nonroot with a read-only root filesystem and all capabilities dropped. It has no public IP, an empty task identity policy, and a fixed permissions boundary. Its execution role can pull only the API image and write API logs. The ALB admits public HTTPS; port 8080 accepts only the ALB security group; task outbound traffic is HTTPS through the dev NAT.

The follow-up plan guard recognizes computed SG views only when they exactly match their separately managed, unchanged security rules. Extra ports, CIDRs, rules or different owners are rejected. This supports an actual post-release no-op plan without weakening the no-update/no-delete gate.

## Remaining acceptance work

A successful authenticated browser → API → Supabase company/admin journey has not been performed with a real production user. The login screen is verified; platform access still requires the existing MFA and role checks. No real customer tenant or extra administrator was silently created.

Manufacturer/charger OAuth, customer consent and physical charging commands remain unverified. The user's BMW 330e 2023 is the intended later pilot; this release sends no car commands. The preserved dashboard previews remain clearly simulated. Daily use inside Gridex/other retailer apps and partner backend credentials require further integration acceptance. Unlimited charging subscriptions remain a separate product concern.
