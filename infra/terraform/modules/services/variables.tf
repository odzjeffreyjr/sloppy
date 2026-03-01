variable "project_name" {
  type = string
}

variable "project_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "registry_url" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
}

variable "service_account_email" {
  description = "Cloud Run service account email (created in root module)"
  type        = string
}

variable "vpc_connector_id" {
  type = string
}

variable "redis_url" {
  type = string
}

variable "gcs_bucket" {
  type = string
}

variable "cdn_url" {
  type = string
}

variable "cors_origin" {
  type    = string
  default = "*"
}

variable "db_connection_url_secret_id" {
  type = string
}

variable "firebase_credentials_secret_id" {
  type = string
}

variable "openai_api_key_secret_id" {
  type = string
}

variable "anthropic_api_key_secret_id" {
  type = string
}

variable "grok_api_key_secret_id" {
  type = string
}

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 10
}
