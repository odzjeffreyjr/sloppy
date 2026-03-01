resource "google_storage_bucket" "game_bundles" {
  name                        = "${var.project_name}-game-bundles-${var.environment}"
  location                    = var.region
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  force_destroy               = var.environment != "prod"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      days_since_noncurrent_time = 90
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.game_bundles.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_compute_backend_bucket" "cdn" {
  name        = "${var.project_name}-cdn-${var.environment}"
  bucket_name = google_storage_bucket.game_bundles.name
  enable_cdn  = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 86400
    max_ttl                      = 31536000
    client_ttl                   = 86400
    serve_while_stale            = 86400
    signed_url_cache_max_age_sec = 0
  }
}

resource "google_compute_url_map" "cdn" {
  name            = "${var.project_name}-cdn-urlmap-${var.environment}"
  default_service = google_compute_backend_bucket.cdn.id
}

resource "google_compute_target_http_proxy" "cdn" {
  name    = "${var.project_name}-cdn-proxy-${var.environment}"
  url_map = google_compute_url_map.cdn.id
}

resource "google_compute_global_forwarding_rule" "cdn" {
  name       = "${var.project_name}-cdn-fwd-${var.environment}"
  target     = google_compute_target_http_proxy.cdn.id
  port_range = "80"
}
