variable "postgres_admin_login" {
  type        = string
  description = "PostgreSQL administrator username"
  default     = "psqladmin"
}

variable "postgres_sku_name" {
  type        = string
  description = "Flexible Server SKU (burstable B1ms is fine for personal dev)"
  default     = "B_Standard_B1ms"
}

variable "postgres_storage_mb" {
  type        = number
  description = "Provisioned storage in MB (32768 = 32 GiB minimum for this SKU path)"
  default     = 32768
}

variable "postgres_version" {
  type        = string
  description = "PostgreSQL major version"
  default     = "16"
}

variable "postgres_client_ip" {
  type        = string
  description = "Your public IP allowed to connect to Postgres (dev). Update if your home IP changes."
  default     = "80.40.233.180"
}
