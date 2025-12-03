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

resource "google_storage_bucket_object" "nlu_config" {
  name         = "r4b-nlu-config.csv"
  bucket       = var.bucket_name
  source       = var.csv_path
  content_type = "text/csv"
  detect_md5hash = filemd5(var.csv_path)
}

output "uploaded_file_name" {
  value = google_storage_bucket_object.nlu_config.name
}
