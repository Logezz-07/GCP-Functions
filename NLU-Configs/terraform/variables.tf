variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "bucket_name" {
  description = "Target GCS bucket for IVA config upload"
  type        = string
}

variable "config_path" {
  description = "Relative path to IVA config file"
  type        = string
  default     = "../R4B-NLU-Config.csv"
}
