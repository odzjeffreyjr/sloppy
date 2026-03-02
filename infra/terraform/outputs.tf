output "api_gateway_url" {
  description = "API gateway URL"
  value       = module.services.api_gateway_url
}

output "backend_service_urls" {
  description = "Backend Cloud Run service URLs"
  value       = module.services.backend_service_urls
}

output "firebase_hosting_url" {
  description = "Firebase Hosting URL (custom domain)"
  value       = "https://sloppygames.io"
}

output "database_connection_string" {
  description = "PostgreSQL connection string"
  value       = module.database.connection_string
  sensitive   = true
}

output "database_instance_connection_name" {
  description = "Cloud SQL instance connection name (for Cloud SQL Proxy)"
  value       = module.database.instance_connection_name
}

output "redis_url" {
  description = "Redis connection URL"
  value       = module.redis.url
}

output "gcs_bucket_name" {
  description = "GCS bucket name for game bundles"
  value       = module.storage.bucket_name
}

output "cdn_url" {
  description = "CDN URL for game bundles"
  value       = module.storage.cdn_url
}

output "registry_url" {
  description = "Artifact Registry URL"
  value       = module.registry.repository_url
}
