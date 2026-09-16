data "aws_availability_zones" "available" {
  state = "available"
}

module "foundation" {
  source = "../../modules/foundation"

  project            = var.project
  environment        = var.environment
  aws_region         = var.aws_region
  account_id         = data.aws_caller_identity.current.account_id
  availability_zones = data.aws_availability_zones.available.names
  vpc_cidr           = "10.40.0.0/16"
}
