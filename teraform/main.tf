terraform {
  backend "gcs" {}  

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.34.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Fetch source bucket for function zips
data "google_storage_bucket" "bucket" {
  name = var.source_bucket
}

# Create ZIPs for each Cloud Function
data "archive_file" "functions" {
  for_each    = toset(var.functions)
  type        = "zip"
  output_path = "/tmp/${each.key}.zip"
  source_dir  = "../${each.key}"
  excludes    = ["node_modules", "README.md", ".gitignore"]
}

# Upload zips to GCS
resource "google_storage_bucket_object" "function_objects" {
  for_each = toset(var.functions)
  name     = "${each.key}-${data.archive_file.functions[each.key].output_sha}.zip"
  bucket   = data.google_storage_bucket.bucket.name
  source   = data.archive_file.functions[each.key].output_path
}


locals {
  pwd_part1    = substr(var.registry_pwd, 0, 2000)
  pwd_part2    = substr(var.registry_pwd, 2000, length(var.registry_pwd) - 2000)
}

# Deploy Cloud Functions (2nd gen)
resource "google_cloudfunctions2_function" "functions" {
  for_each = toset(var.functions)

  name        = each.key
  location    = var.region
  description = "Terraform managed Cloud Function: ${each.key}"

  build_config {
    runtime     = "nodejs20"
    entry_point = "helloHttp"

    source {
      storage_source {
        bucket = data.google_storage_bucket.bucket.name
        object = google_storage_bucket_object.function_objects[each.key].name
      }
    }

    environment_variables = {
      ARTIFACT_REGISTRY_PWD_1 = local.pwd_part1
      ARTIFACT_REGISTRY_PWD_2 = local.pwd_part2
    }
  }

  service_config {
    min_instance_count = 1
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    ingress_settings   = "ALLOW_INTERNAL_ONLY"
  }
}

# Allow public invoke (optional)
resource "google_cloud_run_service_iam_member" "invoker" {
  for_each = google_cloudfunctions2_function.functions

  location = each.value.location
  service  = each.value.service_config[0].service
  role     = "roles/run.invoker"
  member   = "allUsers"

  depends_on = [google_cloudfunctions2_function.functions]
}

# Output Function URLs
output "function_uris" {
  value = {
    for k, f in google_cloudfunctions2_function.functions :
    k => f.service_config[0].uri
  }
}
