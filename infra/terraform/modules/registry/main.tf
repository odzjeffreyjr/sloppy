resource "google_artifact_registry_repository" "main" {
  location      = var.region
  repository_id = "${var.project_name}-${var.environment}"
  format        = "DOCKER"
  description   = "Docker images for ${var.project_name} (${var.environment})"

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      older_than = "2592000s"
      tag_state  = "UNTAGGED"
    }
  }
}
