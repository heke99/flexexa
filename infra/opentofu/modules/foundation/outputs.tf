output "vpc_id" {
  value = aws_vpc.this.id
}

output "public_subnet_ids" {
  value = [for subnet in aws_subnet.public : subnet.id]
}

output "private_subnet_ids" {
  value = [for subnet in aws_subnet.private : subnet.id]
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "ecs_cluster_arn" {
  value = aws_ecs_cluster.this.arn
}

output "ecr_repository_urls" {
  value = {
    for name, repository in aws_ecr_repository.service : name => repository.repository_url
  }
}

output "storage_buckets" {
  value = {
    for purpose, bucket in aws_s3_bucket.storage : purpose => bucket.bucket
  }
}

output "log_groups" {
  value = {
    for service, log_group in aws_cloudwatch_log_group.service : service => log_group.name
  }
}
