locals {
  name_prefix = "${var.project}-${var.environment}"

  common_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "opentofu"
  }
}

# Phase 0 intentionally contains no application resources yet.
# Networking, ECR/ECS, S3/KMS/Secrets Manager, Amazon MQ and Valkey
# are introduced as reviewed modules after state + identity bootstrap.
