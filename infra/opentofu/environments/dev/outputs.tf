output "aws_account_id" {
  description = "Verified account ID returned by the AWS provider during plan/apply."
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "Verified AWS region."
  value       = data.aws_region.current.region
}

output "environment" {
  value = var.environment
}

output "vpc_id" {
  value = module.foundation.vpc_id
}

output "public_subnet_ids" {
  value = module.foundation.public_subnet_ids
}

output "private_subnet_ids" {
  value = module.foundation.private_subnet_ids
}

output "ecs_cluster_name" {
  value = module.foundation.ecs_cluster_name
}

output "ecr_repository_urls" {
  value = module.foundation.ecr_repository_urls
}

output "storage_buckets" {
  value = module.foundation.storage_buckets
}

output "log_groups" {
  value = module.foundation.log_groups
}
