output "backend_service_urls" {
  value = merge(
    {
      for name, service in google_cloud_run_v2_service.backend :
      name => service.uri
    },
    {
      "ai-orchestrator" = google_cloud_run_v2_service.ai_orchestrator.uri
    }
  )
}

output "api_gateway_url" {
  value = google_cloud_run_v2_service.api_gateway.uri
}

