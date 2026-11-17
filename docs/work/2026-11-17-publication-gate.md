# Publication gate correction

2026-11-17: AWS EC2 DescribeSecurityGroups/DescribeSecurityGroupRules and CloudFormation DescribeStackResources verified production Energy EdgeToEnergy rule sgr-08b877099d0ae5e94 targets sg-08f6b75727082b88a in the same VPC vpc-0e6b5f83999698112, TCP 8080, alongside the existing runtime and sandbox peers. Stack flexexa-energy-production owns both the rule and TaskSecurityGroup. No AWS writes performed.

The read-only plan verifier now recognizes exact peer sets containing this production group, preserving all port, CIDR, VPC, owner and no-op checks. Regression cases reject unknown/duplicate peers and modified ports, CIDRs or ownership. 291 infrastructure gate tests pass; diff whitespace check passes. Routing: investigation, verification and deployments used; database, commerce and device-control changes skipped. CI and production publication tracked in PR #75.
