variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "Deployment region"
  type        = string
}


variable "functions" {
  description = "List of Cloud Function directories to deploy"
  type        = list(string)
}

variable "registry_pwd" {
  description = "Artifact Registry NPM token (passed as string)"
  type        = string
  sensitive   = true
}

# Source bucket for function zips
variable "source_bucket" {
  description = "GCS bucket name to store function source zips"
  type        = string
}
