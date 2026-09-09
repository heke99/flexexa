variable "aws_region" {
  description = "AWS region for the Flexexa state bucket."
  type        = string
  default     = "eu-north-1"
}

variable "project" {
  description = "Project identifier."
  type        = string
  default     = "flexexa"
}

variable "state_bucket_prefix" {
  description = "Prefix for the globally unique OpenTofu state bucket."
  type        = string
  default     = "flexexa-tofu-state"
}
