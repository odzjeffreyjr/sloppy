variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "db_connection_url" {
  type      = string
  sensitive = true
}

variable "firebase_credentials_json" {
  type      = string
  sensitive = true
}

variable "openai_api_key" {
  type      = string
  sensitive = true
}

variable "anthropic_api_key" {
  type      = string
  sensitive = true
}

variable "grok_api_key" {
  type      = string
  sensitive = true
}

variable "cloud_run_service_account" {
  description = "Service account email to grant secret access"
  type        = string
}

variable "stripe_secret_key" {
  type      = string
  sensitive = true
  default   = ""
}

variable "stripe_webhook_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "stripe_connect_secret" {
  type      = string
  sensitive = true
  default   = ""
}

variable "fal_key" {
  type      = string
  sensitive = true
  default   = ""
}
