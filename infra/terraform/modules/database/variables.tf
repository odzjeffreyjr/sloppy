variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "region" {
  type = string
}

variable "network_id" {
  type = string
}

variable "private_vpc_connection" {
  description = "VPC peering connection — used only to enforce ordering via the module dependency graph"
  type        = any
  default     = null
}

variable "db_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "disk_size_gb" {
  type    = number
  default = 10
}

variable "db_password" {
  type      = string
  sensitive = true
}
