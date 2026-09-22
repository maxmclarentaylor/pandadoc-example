variable "location" {
  type        = string
  description = "Azure region for dev resources"
  default     = "uksouth"
}

variable "project" {
  type        = string
  description = "Short project name used in resource naming"
  default     = "segment-practice"
}

variable "environment" {
  type        = string
  description = "Environment name"
  default     = "dev"
}

variable "entra_tenant_id" {
  type        = string
  description = "Entra tenant ID used to validate API caller JWTs"
  default     = "c97ce120-adbc-4e5b-b458-5acbac0bc05f"
}

variable "entra_api_client_id" {
  type        = string
  description = "App registration client ID for the API (audience / api://{id})"
  default     = "a4f8ea2d-a323-4974-96f2-f796ea0b18c0"
}

variable "enable_vpn_gateway" {
  type        = bool
  description = "Stage 5: create Point-to-Site VPN Gateway (VpnGw1, ~£25–35/mo). Needed before turning off Postgres public access."
  default     = false
}

variable "postgres_public_network_access" {
  type        = bool
  description = "If false, Postgres has no public endpoint (laptop needs VPN). Keep true until VPN works."
  default     = true
}
