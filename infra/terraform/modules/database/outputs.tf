output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "private_ip_address" {
  value = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  value = google_sql_database.sloppy.name
}

output "database_user" {
  value = google_sql_user.sloppy.name
}

output "connection_string" {
  value     = "postgresql://${google_sql_user.sloppy.name}:${var.db_password}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.sloppy.name}"
  sensitive = true
}
