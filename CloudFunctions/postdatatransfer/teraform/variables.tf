variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
  default     = "roger-470808"
}

variable "region" {
  description = "Default region for provider"
  type        = string
  default     = "us-central1"
}

variable "dialogflow_region" {
  description = "Dialogflow CX region"
  type        = string
  default     = "us-central1"
}

variable "agent_display_name" {
  description = "Display name of the Dialogflow CX agent"
  type        = string
  default     = "R4B-IVA-2"
}

variable "tool_display_name" {
  description = "Display name for the Dialogflow CX Tool"
  type        = string
  default     = "R4B Knowledge Tool"
}

variable "existing_data_store_id" {
  description = "Existing Vertex AI Search Data Store ID"
  type        = string
  default     = "sample_1762759531871"
}
