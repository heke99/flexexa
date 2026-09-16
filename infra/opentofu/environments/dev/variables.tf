variable "aws_region" {
  description = "Primary AWS region."
  type        = string
  default     = "eu-north-1"

  validation {
    condition     = var.aws_region == "eu-north-1"
    error_message = "The reviewed dev foundation is restricted to eu-north-1."
  }
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"

  validation {
    condition     = var.environment == "dev"
    error_message = "This root module may only manage the dev environment."
  }
}

variable "project" {
  description = "Project identifier."
  type        = string
  default     = "flexexa"

  validation {
    condition     = var.project == "flexexa"
    error_message = "This root module may only manage Flexexa resources."
  }
}

variable "github_repository" {
  description = "GitHub repository allowed to federate into AWS."
  type        = string
  default     = "heke99/flexexa"

  validation {
    condition     = var.github_repository == "heke99/flexexa"
    error_message = "The reviewed foundation belongs to heke99/flexexa."
  }
}
