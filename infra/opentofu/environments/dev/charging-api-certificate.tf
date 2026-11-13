# Certificate bootstrap only; no service, routes or marketing-site changes.
resource "aws_acm_certificate" "charging_api" {
  domain_name       = "api-staging.flexexa.com"
  validation_method = "DNS"
  key_algorithm     = "RSA_2048"
  options {
    certificate_transparency_logging_preference = "ENABLED"
  }
  lifecycle {
    prevent_destroy = true
  }
}
output "charging_api_certificate_arn" {
  value = aws_acm_certificate.charging_api.arn
}
output "charging_api_certificate_dns" {
  value = aws_acm_certificate.charging_api.domain_validation_options
}
