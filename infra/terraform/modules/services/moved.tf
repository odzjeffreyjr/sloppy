# Migrate ai-orchestrator from the for_each backend_services map to its own
# standalone resource.  This avoids destroy+create (which would cause downtime)
# and instead tells Terraform to update the resource in-place.

moved {
  from = google_cloud_run_v2_service.backend["ai-orchestrator"]
  to   = google_cloud_run_v2_service.ai_orchestrator
}

moved {
  from = google_cloud_run_v2_service_iam_member.backend_allow_internal["ai-orchestrator"]
  to   = google_cloud_run_v2_service_iam_member.ai_orchestrator_allow_internal
}
