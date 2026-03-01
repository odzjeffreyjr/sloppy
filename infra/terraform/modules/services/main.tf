resource "google_project_iam_member" "cloud_run_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/storage.objectAdmin",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${var.service_account_email}"
}

locals {
  common_env = [
    { name = "NODE_ENV", value = "production" },
    { name = "LOG_LEVEL", value = var.environment == "prod" ? "info" : "debug" },
  ]

  backend_services = {
    "auth" = {
      port = 3002
      env = concat(local.common_env, [
      ])
      secrets = [
        { name = "DATABASE_URL", secret = var.db_connection_url_secret_id, version = "latest" },
        { name = "FIREBASE_SERVICE_ACCOUNT", secret = var.firebase_credentials_secret_id, version = "latest" },
      ]
    }

    "ai-orchestrator" = {
      port = 3004
      env = concat(local.common_env, [
        { name = "REDIS_URL", value = var.redis_url },
        { name = "LLM_PROVIDER", value = "openai" },
        { name = "OPENAI_MODEL", value = "gpt-4o" },
        { name = "ANTHROPIC_MODEL", value = "claude-sonnet-4-20250514" },
        { name = "GROK_MODEL", value = "grok-3" },
        { name = "GENERATION_TIMEOUT_MS", value = "120000" },
        { name = "MAX_TOKENS_CONCEPT", value = "2000" },
        { name = "MAX_TOKENS_CODE", value = "8000" },
        { name = "MAX_TOKENS_ASSETS", value = "2000" },
        { name = "MAX_TOKENS_MULTIPLAYER", value = "4000" },
        { name = "DAILY_COST_THRESHOLD", value = "50" },
      ])
      secrets = [
        { name = "DATABASE_URL", secret = var.db_connection_url_secret_id, version = "latest" },
        { name = "OPENAI_API_KEY", secret = var.openai_api_key_secret_id, version = "latest" },
        { name = "ANTHROPIC_API_KEY", secret = var.anthropic_api_key_secret_id, version = "latest" },
        { name = "GROK_API_KEY", secret = var.grok_api_key_secret_id, version = "latest" },
      ]
    }

    "game-builder" = {
      port = 3003
      env = concat(local.common_env, [
        { name = "REDIS_URL", value = var.redis_url },
        { name = "GCS_BUCKET", value = var.gcs_bucket },
        { name = "CDN_BASE_URL", value = var.cdn_url },
        { name = "MAX_BUNDLE_SIZE_BYTES", value = "5242880" },
        { name = "PLAY_DEBOUNCE_WINDOW_SECONDS", value = "300" },
      ])
      secrets = [
        { name = "DATABASE_URL", secret = var.db_connection_url_secret_id, version = "latest" },
        { name = "FIREBASE_SERVICE_ACCOUNT", secret = var.firebase_credentials_secret_id, version = "latest" },
      ]
    }

    "multiplayer" = {
      port = 3005
      env = concat(local.common_env, [
        { name = "REDIS_URL", value = var.redis_url },
        { name = "REDIS_KEY_TTL", value = "3600" },
        { name = "MAX_CONCURRENT_SESSIONS", value = "100" },
        { name = "MAX_PLAYERS_PER_SESSION", value = "4" },
        { name = "TICK_RATE", value = "20" },
        { name = "WS_HEARTBEAT_INTERVAL", value = "30000" },
        { name = "WS_HEARTBEAT_TIMEOUT", value = "10000" },
        { name = "CLEANUP_INTERVAL", value = "300000" },
        { name = "EMPTY_ROOM_TIMEOUT", value = "60000" },
      ])
      secrets = [
        { name = "DATABASE_URL", secret = var.db_connection_url_secret_id, version = "latest" },
        { name = "FIREBASE_SERVICE_ACCOUNT", secret = var.firebase_credentials_secret_id, version = "latest" },
      ]
    }
  }
}

resource "google_cloud_run_v2_service" "backend" {
  for_each = local.backend_services

  name     = "${var.project_name}-${each.key}-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    containers {
      image = "${var.registry_url}/${each.key}:${var.image_tag}"

      ports {
        container_port = each.value.port
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      dynamic "env" {
        for_each = each.value.env
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      dynamic "env" {
        for_each = each.value.secrets
        content {
          name = env.value.name
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = each.value.port
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = each.value.port
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service" "api_gateway" {
  name     = "${var.project_name}-api-gateway-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "ALL_TRAFFIC"
    }

    containers {
      image = "${var.registry_url}/api-gateway:${var.image_tag}"

      ports {
        container_port = 3001
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
      }

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "LOG_LEVEL"
        value = var.environment == "prod" ? "info" : "debug"
      }
      env {
        name  = "CORS_ORIGIN"
        value = var.cors_origin
      }
      env {
        name  = "REDIS_URL"
        value = var.redis_url
      }
      env {
        name  = "FIREBASE_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "RATE_LIMIT_GENERAL_AUTH_RPM"
        value = "100"
      }
      env {
        name  = "RATE_LIMIT_GENERAL_UNAUTH_RPM"
        value = "30"
      }
      env {
        name  = "RATE_LIMIT_GENERATION_PER_HOUR"
        value = "5"
      }
      env {
        name  = "AUTH_SERVICE_URL"
        value = google_cloud_run_v2_service.backend["auth"].uri
      }
      env {
        name  = "GAME_BUILDER_URL"
        value = google_cloud_run_v2_service.backend["game-builder"].uri
      }
      env {
        name  = "AI_ORCHESTRATOR_URL"
        value = google_cloud_run_v2_service.backend["ai-orchestrator"].uri
      }
      env {
        name  = "MULTIPLAYER_URL"
        value = google_cloud_run_v2_service.backend["multiplayer"].uri
      }

      env {
        name = "FIREBASE_SERVICE_ACCOUNT"
        value_source {
          secret_key_ref {
            secret  = var.firebase_credentials_secret_id
            version = "latest"
          }
        }
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 3001
        }
        initial_delay_seconds = 5
        period_seconds        = 5
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 3001
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service_iam_member" "gateway_public" {
  name     = google_cloud_run_v2_service.api_gateway.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "backend_allow_internal" {
  for_each = local.backend_services

  name     = google_cloud_run_v2_service.backend[each.key].name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
