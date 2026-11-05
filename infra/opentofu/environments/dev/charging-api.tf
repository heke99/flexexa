variable "enable_charging_api" {
  type        = bool
  default     = false
  description = "Enable only after image scans, ACM validation and the reviewed runtime plan pass."
}
variable "charging_api_image" {
  type    = string
  default = ""
}
variable "charging_api_certificate_arn" {
  type    = string
  default = ""
}
variable "charging_api_publishable_key" {
  type    = string
  default = ""
}
module "charging_api" {
  count                   = var.enable_charging_api ? 1 : 0
  source                  = "../../modules/charging-api"
  depends_on              = [module.foundation]
  cluster_arn             = module.foundation.ecs_cluster_arn
  vpc_id                  = module.foundation.vpc_id
  public_subnets          = module.foundation.public_subnet_ids
  private_subnets         = module.foundation.private_subnet_ids
  private_route_table_ids = module.foundation.private_route_table_ids
  image                   = var.charging_api_image
  certificate_arn         = var.charging_api_certificate_arn
  supabase_url            = "https://zhgwlvmtvwjftyjmgljw.supabase.co"
  publishable_key         = var.charging_api_publishable_key
  log_group               = module.foundation.log_groups["api"]
}
output "charging_api_load_balancer_dns" {
  value = try(module.charging_api[0].load_balancer_dns, null)
}
