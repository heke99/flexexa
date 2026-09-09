variable "project" {
  description = "Project identifier."
  type        = string
}

variable "environment" {
  description = "Deployment environment."
  type        = string
}

variable "aws_region" {
  description = "AWS region."
  type        = string
}

variable "account_id" {
  description = "Target AWS account ID."
  type        = string
}

variable "availability_zones" {
  description = "Available AZ names. The foundation uses the first two."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 2
    error_message = "Flexexa foundation requires at least two availability zones."
  }
}

variable "vpc_cidr" {
  description = "IPv4 CIDR for the Flexexa VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "service_names" {
  description = "Canonical container service names that receive ECR repositories and log groups."
  type        = set(string)
  default = [
    "api",
    "connector",
    "control",
    "optimizer",
    "flex",
    "settlement",
    "workers",
  ]
}
