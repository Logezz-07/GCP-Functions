provider "google" {
  project = var.project_id
}

resource "google_storage_bucket_object" "iva_config" {
  name         = "config.json"
  bucket       = var.bucket_name
  source       = var.config_path
  content_type = "application/json"
}

output "uploaded_file_name" {
  value = google_storage_bucket_object.iva_config.name
}