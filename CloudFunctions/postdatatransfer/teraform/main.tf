terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
  required_version = ">= 1.6.0"
}

provider "google" {
  project     = var.project_id
  region      = var.region
  credentials = file("C:/Users/logeshwaran.b/OneDrive - Servion Global Solution Private Limited/Desktop/R4B/CloudFunctions/ServiceAccount-SecretKeys.json")
}

data "google_project" "project" {}


# ─────────────────────────────────────────────
resource "google_dialogflow_cx_agent" "agent" {
  display_name              = var.agent_display_name
  location                  = var.dialogflow_region
  default_language_code     = "en"
  time_zone                 = "America/New_York"
  description               = "CX Agent automatically linked to Vertex AI Search Data Store"
  delete_chat_engine_on_destroy = false
}

# ─────────────────────────────────────────────
# 2️⃣ Create a Dialogflow CX Tool referencing existing Vertex AI Data Store
# ─────────────────────────────────────────────
resource "google_dialogflow_cx_tool" "data_store_tool" {
  # Use the agent created above
  parent       = google_dialogflow_cx_agent.agent.id
  display_name = var.tool_display_name
  description  = "Tool referencing existing Vertex AI Search Data Store"

  data_store_spec {
    data_store_connections {
      data_store_type          = "STRUCTURED"
      # 👇 Reference your existing Data Store (already created in GCP)
      data_store               = "projects/${data.google_project.project.number}/locations/us/collections/default_collection/dataStores/${var.existing_data_store_id}"
      document_processing_mode = "DOCUMENTS"
    }
    fallback_prompt {}
  }

  depends_on = [
    google_dialogflow_cx_agent.agent
  ]
}

# ─────────────────────────────────────────────
# 3️⃣ Outputs
# ─────────────────────────────────────────────
output "agent_name" {
  description = "Dialogflow CX Agent full resource path"
  value       = google_dialogflow_cx_agent.agent.id
}

output "tool_name" {
  description = "Dialogflow CX Tool resource path"
  value       = google_dialogflow_cx_tool.data_store_tool.name
}
