terraform {
  backend "gcs" {
    bucket = "sloppy-terraform-state"
    prefix = "terraform/state"
  }
}
