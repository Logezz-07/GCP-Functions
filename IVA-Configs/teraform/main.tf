terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 5.0.0"
    }
  }

  backend "gcs" {}
}

provider "google" {
  project = var.project_id
}

# Upload the IVA config file to GCS
resource "google_storage_bucket_object" "iva_config" {
  name         = "config.json"
  bucket       = var.bucket_name
  source       = var.config_path
  content_type = "application/json"
}

# Output the uploaded file name
output "uploaded_file_name" {
  value = google_storage_bucket_object.iva_config.name
}
