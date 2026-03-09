output "db_connection_url_secret_id" {
  value = google_secret_manager_secret.secrets["db-connection-url"].secret_id
}

output "firebase_credentials_secret_id" {
  value = google_secret_manager_secret.secrets["firebase-credentials"].secret_id
}

output "openai_api_key_secret_id" {
  value = google_secret_manager_secret.secrets["openai-api-key"].secret_id
}

output "anthropic_api_key_secret_id" {
  value = google_secret_manager_secret.secrets["anthropic-api-key"].secret_id
}

output "grok_api_key_secret_id" {
  value = google_secret_manager_secret.secrets["grok-api-key"].secret_id
}

output "stripe_secret_key_secret_id" {
  value = var.stripe_secret_key != "" ? google_secret_manager_secret.secrets["stripe-secret-key"].secret_id : ""
}

output "stripe_webhook_secret_secret_id" {
  value = var.stripe_secret_key != "" ? google_secret_manager_secret.secrets["stripe-webhook-secret"].secret_id : ""
}

output "stripe_connect_secret_secret_id" {
  value = var.stripe_secret_key != "" ? google_secret_manager_secret.secrets["stripe-connect-secret"].secret_id : ""
}

output "fal_key_secret_id" {
  value = var.fal_key != "" ? google_secret_manager_secret.secrets["fal-key"].secret_id : ""
}
