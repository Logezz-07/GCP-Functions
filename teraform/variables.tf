# Project and region
variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "Deployment region"
  type        = string
}

# Function names
variable "functions" {
  description = "List of Cloud Function directories to deploy"
  type        = list(string)
}

# Artifact Registry token
variable "registry_pwd_file" {
  description = "Artifact Registry NPM token (passed as string)"
  type        = string
}

# Source bucket for function zips
variable "source_bucket" {
  description = "GCS bucket name to store function source zips"
  type        = string
  default     = "roger-470808-gcf-source"
}

# Terraform state bucket
variable "tf_state_bucket" {
  description = "GCS bucket for Terraform remote state"
  type        = string
  default     = "roger-470808-terraform-state"
}
