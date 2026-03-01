resource "google_redis_instance" "main" {
  name               = "${var.project_name}-redis-${var.environment}"
  tier               = "BASIC"
  memory_size_gb     = var.memory_size_gb
  region             = var.region
  redis_version      = "REDIS_7_2"
  authorized_network = var.network_id
  connect_mode       = "PRIVATE_SERVICE_ACCESS"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 4
        minutes = 0
      }
    }
  }
}
