terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "redis.googleapis.com",
    "storage.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "vpcaccess.googleapis.com",
    "servicenetworking.googleapis.com",
    "compute.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# ── Service Account (shared by all Cloud Run services) ──────────────────────
# Defined here to break the circular dependency between secrets and services.

resource "google_service_account" "cloud_run" {
  account_id   = "${var.project_name}-run-${var.environment}"
  display_name = "Cloud Run Service Account (${var.environment})"

  depends_on = [google_project_service.apis]
}

# ── Modules ─────────────────────────────────────────────────────────────────

module "networking" {
  source = "./modules/networking"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region

  depends_on = [google_project_service.apis]
}

module "database" {
  source = "./modules/database"

  project_name           = var.project_name
  environment            = var.environment
  region                 = var.region
  network_id             = module.networking.network_id
  private_vpc_connection = module.networking.private_vpc_connection
  db_tier                = var.db_tier
  db_password            = var.db_password

  depends_on = [google_project_service.apis, module.networking]
}

module "redis" {
  source = "./modules/redis"

  project_name           = var.project_name
  environment            = var.environment
  region                 = var.region
  network_id             = module.networking.network_id
  private_vpc_connection = module.networking.private_vpc_connection
  memory_size_gb         = var.redis_memory_gb

  depends_on = [google_project_service.apis, module.networking]
}

module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region
  cors_origins = var.cors_origins

  depends_on = [google_project_service.apis]
}

module "registry" {
  source = "./modules/registry"

  project_name = var.project_name
  environment  = var.environment
  region       = var.region

  depends_on = [google_project_service.apis]
}

module "secrets" {
  source = "./modules/secrets"

  project_name              = var.project_name
  environment               = var.environment
  db_password               = var.db_password
  db_connection_url         = module.database.connection_string
  firebase_credentials_json = var.firebase_credentials_json
  openai_api_key            = var.openai_api_key
  anthropic_api_key         = var.anthropic_api_key
  grok_api_key              = var.grok_api_key
  cloud_run_service_account = google_service_account.cloud_run.email

  depends_on = [google_project_service.apis, module.database]
}

module "services" {
  source = "./modules/services"

  project_name          = var.project_name
  project_id            = var.project_id
  environment           = var.environment
  region                = var.region
  registry_url          = module.registry.repository_url
  image_tag             = var.image_tag
  service_account_email = google_service_account.cloud_run.email
  min_instances         = var.min_instances
  max_instances         = var.max_instances

  vpc_connector_id = module.networking.vpc_connector_id
  redis_url        = module.redis.url
  gcs_bucket       = module.storage.bucket_name
  cdn_url          = module.storage.cdn_url
  cors_origin      = var.cors_origin

  db_connection_url_secret_id    = module.secrets.db_connection_url_secret_id
  firebase_credentials_secret_id = module.secrets.firebase_credentials_secret_id
  openai_api_key_secret_id       = module.secrets.openai_api_key_secret_id
  anthropic_api_key_secret_id    = module.secrets.anthropic_api_key_secret_id
  grok_api_key_secret_id         = module.secrets.grok_api_key_secret_id

  depends_on = [
    google_project_service.apis,
    module.database,
    module.redis,
    module.secrets,
  ]
}
