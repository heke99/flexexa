# Development Fargate recovery

Initial apply 42088268526 created six resources then failed on AWS dependency resource authorization. The VPC/subnet/EIP dependency ARNs now have narrowly scoped create authorization. ECS DescribeTaskDefinition requires resource `*` per AWS service authorization; the read remains Stockholm-only. No broader mutation rights are added.

Root readback confirms task definition revision 1 is ACTIVE with the verified image; state serial 3 marked it tainted because its post-create read lacked authorization. Read-only PR planning may review exactly this tainted revision without executing a replacement. Protected-main recovery independently verifies live AWS task definition, image, roles, public environment, nonroot configuration and exact state identity before running OpenTofu untaint. The actual apply guard still forbids every replacement/update/delete.

Already-created resources must be unchanged. Equivalent provider default-tag projections are permitted only with identical three project/environment/management tags; other runtime drift fails.
