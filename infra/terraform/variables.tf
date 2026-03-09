variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name prefix for resources"
  type        = string
  default     = "sloppy"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-east1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "db_tier" {
  description = "Cloud SQL instance tier"
  type        = string
  default     = "db-f1-micro"
}

variable "db_password" {
  description = "Database password (stored in Secret Manager)"
  type        = string
  sensitive   = true
}

variable "redis_memory_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
}

variable "firebase_credentials_json" {
  description = "Firebase service account JSON (stored in Secret Manager)"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key (stored in Secret Manager)"
  type        = string
  sensitive   = true
}

variable "anthropic_api_key" {
  description = "Anthropic API key (stored in Secret Manager)"
  type        = string
  sensitive   = true
}

variable "grok_api_key" {
  description = "Grok (xAI) API key (stored in Secret Manager)"
  type        = string
  sensitive   = true
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

variable "min_instances" {
  description = "Minimum Cloud Run instances (0 = scale to zero)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum Cloud Run instances"
  type        = number
  default     = 10
}

variable "cors_origin" {
  description = "CORS allowed origin for the API gateway"
  type        = string
  default     = "*"
}

variable "cors_origins" {
  description = "CORS origins for GCS bucket"
  type        = list(string)
  default     = ["*"]
}

variable "stripe_secret_key" {
  description = "Stripe secret API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook signing secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_connect_secret" {
  description = "Stripe Connect secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_price_id" {
  description = "Stripe price ID for subscriptions"
  type        = string
  default     = ""
}

variable "fal_key" {
  description = "fal.ai API key for thumbnail generation (stored in Secret Manager)"
  type        = string
  sensitive   = true
  default     = ""
}
