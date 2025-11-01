variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "region" {
  description = "GCP Region"
  type        = string
}

variable "secret_project_id" {
  description = "GCP Secret Project ID"
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

variable "source_bucket" {
  description = "GCS bucket name to store function source zips"
  type        = string
}

# -----------------------------
# Runtime Environment Variables
# -----------------------------
variable "token_url" {
  description = "OAuth token URL for the API"
  type        = string
}

variable "scope" {
  description = "Scope value for token generation"
  type        = string
}

variable "token_refresh_time" {
  description = "Token refresh threshold in minutes"
  type        = string
}

# -----------------------------
# Secret Manager References
# -----------------------------
variable "client_id_secret" {
  description = "Secret name in Secret Manager for Client ID"
  type        = string
}

variable "client_secret_secret" {
  description = "Secret name in Secret Manager for Client Secret"
  type        = string
}
