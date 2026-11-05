# Optional development API runtime. No control/dispatch commands are exposed.
variable "cluster_arn" { type = string }
variable "vpc_id" { type = string }
variable "public_subnets" { type = list(string) }
variable "private_subnets" { type = list(string) }
variable "image" {
  type = string
  validation {
    condition     = can(regex("^938095765653\\.dkr\\.ecr\\.eu-north-1\\.amazonaws\\.com/flexexa/dev/api@sha256:[a-f0-9]{64}$", var.image))
    error_message = "Use the scanned immutable API image in the reviewed dev account."
  }
}
variable "certificate_arn" {
  type = string
  validation {
    condition     = can(regex("^arn:aws:acm:eu-north-1:938095765653:certificate/[a-f0-9-]+$", var.certificate_arn))
    error_message = "Provide an issued ACM certificate in the reviewed region and account."
  }
}
variable "supabase_url" { type = string }
variable "publishable_key" {
  type = string
  validation {
    condition     = can(regex("^sb_publishable_[A-Za-z0-9_-]+$", var.publishable_key))
    error_message = "Only a public publishable key is allowed; never service-role credentials."
  }
}
variable "log_group" { type = string }
resource "aws_security_group" "edge" {
  name_prefix = "flexexa-dev-api-edge-"
  vpc_id      = var.vpc_id
}
resource "aws_security_group" "task" {
  name_prefix = "flexexa-dev-api-task-"
  vpc_id      = var.vpc_id
}
resource "aws_vpc_security_group_ingress_rule" "https" {
  security_group_id = aws_security_group.edge.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}
resource "aws_vpc_security_group_egress_rule" "edge_task" {
  security_group_id            = aws_security_group.edge.id
  referenced_security_group_id = aws_security_group.task.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}
resource "aws_vpc_security_group_ingress_rule" "task_edge" {
  security_group_id            = aws_security_group.task.id
  referenced_security_group_id = aws_security_group.edge.id
  ip_protocol                  = "tcp"
  from_port                    = 8080
  to_port                      = 8080
}
resource "aws_vpc_security_group_egress_rule" "tls" {
  security_group_id = aws_security_group.task.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
}
resource "aws_lb" "api" {
  name                       = "flexexa-dev-charging-api"
  load_balancer_type         = "application"
  subnets                    = var.public_subnets
  security_groups            = [aws_security_group.edge.id]
  drop_invalid_header_fields = true
}
resource "aws_lb_target_group" "api" {
  name                 = "flexexa-dev-charging-api"
  port                 = 8080
  protocol             = "HTTP"
  target_type          = "ip"
  vpc_id               = var.vpc_id
  deregistration_delay = 15
  health_check {
    path    = "/health/live"
    matcher = "200"
  }
}
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}
locals {
  trust = jsonencode({ Version = "2012-10-17", Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole", Condition = { StringEquals = { "aws:SourceAccount" = "938095765653" }, ArnLike = { "aws:SourceArn" = "arn:aws:ecs:eu-north-1:938095765653:*" } } }] })
}
resource "aws_iam_role" "execution" {
  name               = "flexexa-dev-charging-api-execution"
  assume_role_policy = local.trust
}
resource "aws_iam_role" "task" {
  name               = "flexexa-dev-charging-api-task"
  assume_role_policy = local.trust
}
resource "aws_iam_role_policy" "execution" {
  role = aws_iam_role.execution.id
  policy = jsonencode({ Version = "2012-10-17", Statement = [
    { Effect = "Allow", Action = ["ecr:GetAuthorizationToken"], Resource = "*" },
    { Effect = "Allow", Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"], Resource = "arn:aws:ecr:eu-north-1:938095765653:repository/flexexa/dev/api" },
    { Effect = "Allow", Action = ["logs:CreateLogStream", "logs:PutLogEvents"], Resource = "arn:aws:logs:eu-north-1:938095765653:log-group:${var.log_group}:*" }
  ] })
}
resource "aws_ecs_task_definition" "api" {
  family                   = "flexexa-dev-charging-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn
  container_definitions = jsonencode([{ name = "api", image = var.image, essential = true, user = "65532:65532", readonlyRootFilesystem = true,
    portMappings     = [{ containerPort = 8080, protocol = "tcp" }],
    environment      = [{ name = "SUPABASE_URL", value = var.supabase_url }, { name = "SUPABASE_PUBLISHABLE_KEY", value = var.publishable_key }, { name = "PORT", value = "8080" }],
    linuxParameters  = { capabilities = { drop = ["ALL"] } }, stopTimeout = 15,
    healthCheck      = { command = ["CMD", "/usr/bin/node", "-e", "fetch('http://127.0.0.1:8080/health/live',{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"], interval = 30, timeout = 5, retries = 3, startPeriod = 15 },
    logConfiguration = { logDriver = "awslogs", options = { "awslogs-group" = var.log_group, "awslogs-region" = "eu-north-1", "awslogs-stream-prefix" = "charging-api", "mode" = "blocking" } }
  }])
}
resource "aws_ecs_service" "api" {
  name                               = "flexexa-dev-charging-api"
  cluster                            = var.cluster_arn
  task_definition                    = aws_ecs_task_definition.api.arn
  desired_count                      = 1
  launch_type                        = "FARGATE"
  health_check_grace_period_seconds  = 60
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  network_configuration {
    subnets          = var.private_subnets
    security_groups  = [aws_security_group.task.id]
    assign_public_ip = false
  }
  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 8080
  }
  depends_on = [aws_lb_listener.https, aws_iam_role_policy.execution, aws_route.egress]
}
output "load_balancer_dns" { value = aws_lb.api.dns_name }

# One NAT gateway for the dev service's outbound TLS to Supabase/ECR/CloudWatch.
# This module is opt-in and creates billable runtime resources when enabled.
variable "private_route_table_ids" { type = list(string) }
resource "aws_eip" "egress" { domain = "vpc" }
resource "aws_nat_gateway" "egress" {
  allocation_id = aws_eip.egress.id
  subnet_id     = var.public_subnets[0]
}
resource "aws_route" "egress" {
  for_each               = { for i, id in var.private_route_table_ids : tostring(i) => id }
  route_table_id         = each.value
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.egress.id
}
