# Verified Energy sandbox egress projection

OpenTofu run43496049556 reported no configuration changes, then the fail-closed runtime read-back guard rejected aws_security_group.edge.egress. AWS read-back confirms the shared ALB's TCP8080 egress now groups two peers: the existing charging runtime and the separately deployed Energy sandbox.

CloudFormation stack flexexa-energy-sandbox owns EdgeToEnergy (sgr-0e251aad7ed953792) and TaskSecurityGroup (sg-08817d86ba10859c6). The edge is sg-0b3062b2e7a019572, the original charging peer is sg-00ed64209d55b98ea, and both destinations are in vpc-0e6b5f83999698112. EC2 confirms Energy ingress only from that edge on8080. No network rule is changed by this PR.

The guard now accepts that exact additional peer in the computed view only when the original standalone rule and edge resource remain unchanged. Port/protocol, absent CIDRs, empty IPv6/prefix lists and no self access remain enforced. Other peers, a changed original rule, VPC, port or CIDR still fail. Two added tests exercise the accepted order-independent set and rejected mutations. All289 infrastructure tests pass locally. Frontend code is unchanged from the already verified merged tree.

Partner onboarding remains deferred. Existing container OS findings remain a production gate; the Trixie experiment did not resolve them and was not committed. Backend PR14 is merged as2282e0d6f4ca7453f376b8ae78bfc94d6fd47d25 after local functional CI; web PR73 still requires the actual hosted plan-dev result.
