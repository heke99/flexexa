provider "aws" {
  region              = var.aws_region
  allowed_account_ids = ["938095765653"]

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.environment
      ManagedBy   = "opentofu"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
