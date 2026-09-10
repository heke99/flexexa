variable "aws_region" {
  description = "Primary AWS region."
  type        = string
  default     = "eu-north-1"
}

variable "environment" {
  description = "Deployment environment."
  type        = string
  default     = "dev"
}

variable "project" {
  description = "Project identifier."
  type        = string
  default     = "flexexa"
}

variable "github_repository" {
  description = "GitHub repository allowed to federate into AWS."
  type        = string
  default     = "heke99/flexexa"
}
