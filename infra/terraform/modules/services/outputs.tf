output "backend_service_urls" {
  value = {
    for name, service in google_cloud_run_v2_service.backend :
    name => service.uri
  }
}

output "api_gateway_url" {
  value = google_cloud_run_v2_service.api_gateway.uri
}

output "web_url" {
  value = google_cloud_run_v2_service.web.uri
}
