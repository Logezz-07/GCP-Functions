terraform {

  backend "gcs" {
    bucket = "roger-470808-terraform-state" 
    prefix = "cloud-functions-state"              
  }
  
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = ">= 4.34.0"
    }
  }
}

variable "project_id" {}
variable "region" {}
variable "functions" {
  type = list(string)
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Use existing bucket for function source
data "google_storage_bucket" "bucket" {
  name = "roger-470808-gcf-source"
}


# Archive function source code
data "archive_file" "functions" {
  for_each    = toset(var.functions)
  type        = "zip"
  output_path = "/tmp/${each.key}.zip"
  source_dir  = "../${each.key}"  
  excludes    = ["node_modules","README.md",".gitignore"]
}

# Upload each zip to bucket
resource "google_storage_bucket_object" "function_objects" {
  for_each = toset(var.functions)
  name     = "${each.key}-${data.archive_file.functions[each.key].output_sha}.zip"
  bucket   = data.google_storage_bucket.bucket.name
  source   = data.archive_file.functions[each.key].output_path
}

# Create Cloud Functions
resource "google_cloudfunctions2_function" "functions" {
  for_each    = toset(var.functions)
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
  }

  service_config {
    min_instance_count = 1
    max_instance_count = 1
    available_memory   = "256M"
    timeout_seconds    = 60
    ingress_settings   = "ALLOW_INTERNAL_ONLY"
  }
}

# Allow public HTTP invoke
resource "google_cloud_run_service_iam_member" "member" {
  for_each = google_cloudfunctions2_function.functions

  location = each.value.location
  service  = each.value.service_config[0].service
  role     = "roles/run.invoker"
  member   = "allUsers"

  depends_on = [google_cloudfunctions2_function.functions]
}

# Output function URLs
output "function_uris" {
  value = {
    for k, f in google_cloudfunctions2_function.functions :
    k => f.service_config[0].uri
  }
}