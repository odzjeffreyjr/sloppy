output "bucket_name" {
  value = google_storage_bucket.game_bundles.name
}

output "bucket_url" {
  value = google_storage_bucket.game_bundles.url
}

output "cdn_ip" {
  value = google_compute_global_forwarding_rule.cdn.ip_address
}

output "cdn_url" {
  value = "http://${google_compute_global_forwarding_rule.cdn.ip_address}"
}
