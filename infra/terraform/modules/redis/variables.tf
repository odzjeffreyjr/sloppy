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

variable "memory_size_gb" {
  type    = number
  default = 1
}
