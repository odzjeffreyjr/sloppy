terraform {
  backend "gcs" {
    bucket = "sloppy-app-tf-state"
    prefix = "terraform/state"
  }
}
