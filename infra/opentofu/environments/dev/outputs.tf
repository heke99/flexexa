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
