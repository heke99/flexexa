output "account_id" {
  description = "AWS account receiving Flexexa infrastructure."
  value       = data.aws_caller_identity.current.account_id
}

output "region" {
  description = "AWS region used for the bootstrap."
  value       = data.aws_region.current.region
}

output "state_bucket_name" {
  description = "S3 bucket used for OpenTofu remote state."
  value       = aws_s3_bucket.state.bucket
}
