locals {
  secrets = merge(
    {
      "db-connection-url"    = var.db_connection_url
      "firebase-credentials" = var.firebase_credentials_json
      "openai-api-key"       = var.openai_api_key
      "anthropic-api-key"    = var.anthropic_api_key
      "grok-api-key"         = var.grok_api_key
    },
    var.stripe_secret_key != "" ? {
      "stripe-secret-key"    = var.stripe_secret_key
      "stripe-webhook-secret" = var.stripe_webhook_secret
      "stripe-connect-secret" = var.stripe_connect_secret
    } : {},
    var.fal_key != "" ? {
      "fal-key" = var.fal_key
    } : {}
  )
}

resource "google_secret_manager_secret" "secrets" {
  for_each = local.secrets

  secret_id = "${var.project_name}-${each.key}-${var.environment}"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "versions" {
  for_each = local.secrets

  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value
}

resource "google_secret_manager_secret_iam_member" "access" {
  for_each = local.secrets

  secret_id = google_secret_manager_secret.secrets[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cloud_run_service_account}"
}
